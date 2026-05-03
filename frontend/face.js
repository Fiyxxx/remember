import { LocalState } from "./state.js";

let faceMatcher = null;
let modelsLoaded = false;
const trackedFaces = new Map();
const FACE_TIMEOUT_MS = 800;
const SPATIAL_THRESHOLD = 200;
const DESCRIPTOR_THRESHOLD = 0.65;

function descriptorDist(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export async function loadModels() {
  await faceapi.nets.tinyFaceDetector.loadFromUri("/models");
  await faceapi.nets.faceLandmark68TinyNet.loadFromUri("/models");
  await faceapi.nets.faceRecognitionNet.loadFromUri("/models");
  modelsLoaded = true;
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
  if (!modelsLoaded || videoEl.readyState < 2) return;

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
      // Remove any unknown entry that was tracking this same physical face
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      for (const [uid, tracked] of trackedFaces) {
        if (tracked.matched) continue;
        const descDist = descriptorDist(d.descriptor, tracked.descriptor);
        const tcx = tracked.bbox.x + tracked.bbox.w / 2;
        const tcy = tracked.bbox.y + tracked.bbox.h / 2;
        const spatialDist = Math.hypot(cx - tcx, cy - tcy);
        if (descDist < DESCRIPTOR_THRESHOLD || spatialDist < SPATIAL_THRESHOLD) {
          trackedFaces.delete(uid);
        }
      }

      trackedFaces.set(label, {
        id: label,
        bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
        descriptor: d.descriptor,
        matched: true,
        lastSeenAt: now,
      });
    } else {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      let bestId = null;
      let bestScore = Infinity;

      // First try to match against existing tracked faces (unknown OR matched)
      for (const [id, tracked] of trackedFaces) {
        const descDist = descriptorDist(d.descriptor, tracked.descriptor);
        if (descDist < DESCRIPTOR_THRESHOLD) {
          if (descDist < bestScore) {
            bestScore = descDist;
            bestId = id;
          }
          continue;
        }

        if (tracked.matched) continue;

        const tcx = tracked.bbox.x + tracked.bbox.w / 2;
        const tcy = tracked.bbox.y + tracked.bbox.h / 2;
        const spatialDist = Math.hypot(cx - tcx, cy - tcy);
        if (spatialDist < SPATIAL_THRESHOLD && spatialDist < bestScore) {
          bestScore = spatialDist;
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
