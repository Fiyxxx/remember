import { LocalState } from "./state.js";

let faceMatcher = null;
const trackedFaces = new Map(); // id → face + lastSeenAt
const FACE_TIMEOUT_MS = 600;

export async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
  await faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
  console.log("[face] Models loaded");
}

export function buildFaceMatcher(kg) {
  const labeled = Object.entries(kg.people)
    .filter(([, p]) => Array.isArray(p.descriptor) && p.descriptor.length === 128)
    .map(
      ([id, p]) =>
        new faceapi.LabeledFaceDescriptors(id, [new Float32Array(p.descriptor)])
    );

  if (labeled.length === 0) {
    faceMatcher = null;
    return null;
  }
  faceMatcher = new faceapi.FaceMatcher(labeled, 0.5);
  console.log("[face] FaceMatcher built with", labeled.length, "known face(s)");
  return faceMatcher;
}

async function runDetectionLoop(videoEl) {
  if (videoEl.readyState < 2) return;

  const detections = await faceapi
    .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptors();

  const now = Date.now();

  for (const d of detections) {
    const box = d.detection.box;
    let label = null;
    let matched = false;

    if (faceMatcher) {
      const match = faceMatcher.findBestMatch(d.descriptor);
      if (match.label !== "unknown") {
        label = match.label;
        matched = true;
      }
    }

    if (matched) {
      trackedFaces.set(label, {
        id: label,
        bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
        descriptor: d.descriptor,
        matched: true,
        lastSeenAt: now,
      });
    } else {
      // Match to nearest existing unknown by center distance
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      let bestId = null;
      let bestDist = Infinity;

      for (const [id, tracked] of trackedFaces) {
        if (tracked.matched) continue;
        const tcx = tracked.bbox.x + tracked.bbox.w / 2;
        const tcy = tracked.bbox.y + tracked.bbox.h / 2;
        const dist = Math.hypot(cx - tcx, cy - tcy);
        if (dist < bestDist && dist < 100) {
          bestDist = dist;
          bestId = id;
        }
      }

      if (bestId) {
        const existing = trackedFaces.get(bestId);
        trackedFaces.set(bestId, {
          ...existing,
          bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
          descriptor: d.descriptor,
          lastSeenAt: now,
        });
      } else {
        const newId = "unknown_" + Math.random().toString(36).slice(2, 6);
        trackedFaces.set(newId, {
          id: newId,
          bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
          descriptor: d.descriptor,
          matched: false,
          lastSeenAt: now,
        });
      }
    }
  }

  // Expire faces not seen for FACE_TIMEOUT_MS
  for (const [id, face] of trackedFaces) {
    if (now - face.lastSeenAt > FACE_TIMEOUT_MS) {
      trackedFaces.delete(id);
    }
  }

  LocalState.activeFaces = Array.from(trackedFaces.values());
}

export function startDetectionLoop(videoEl) {
  setInterval(() => runDetectionLoop(videoEl), 100);
}

// Captures a face descriptor from the live video frame.
// Returns { person_id, descriptor } or null if no face detected.
export async function enrollFromVideo(videoEl, name) {
  const detection = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) {
    console.warn("[face] No face detected in current frame");
    return null;
  }

  const person_id = name.toLowerCase().replace(/\s+/g, "_");
  const descriptor = Array.from(detection.descriptor);
  return { person_id, descriptor };
}
