import { LocalState } from "./state.js";

let faceMatcher = null;

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

  LocalState.activeFaces = detections.map((d) => {
    const box = d.detection.box;
    let label = "unknown_" + Math.random().toString(36).slice(2, 6);
    let matched = false;

    if (faceMatcher) {
      const match = faceMatcher.findBestMatch(d.descriptor);
      if (match.label !== "unknown") {
        label = match.label;
        matched = true;
      }
    }

    return {
      id: label,
      bbox: { x: box.x, y: box.y, w: box.width, h: box.height },
      descriptor: d.descriptor,
      matched,
    };
  });
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

  const stored = JSON.parse(localStorage.getItem("enrolled_descriptors") || "{}");
  stored[person_id] = { display_name: name, descriptor };
  localStorage.setItem("enrolled_descriptors", JSON.stringify(stored));

  console.log("[face] Enrolled", name, "from webcam and saved to localStorage");
  return { person_id, descriptor };
}

export function loadEnrolledDescriptors(kg) {
  const stored = JSON.parse(localStorage.getItem("enrolled_descriptors") || "{}");
  for (const [person_id, data] of Object.entries(stored)) {
    if (!kg.people[person_id]) {
      kg.people[person_id] = {
        descriptor: data.descriptor,
        display_name: data.display_name,
        topics: [],
        first_met: new Date().toISOString().slice(0, 10),
        last_seen: null,
        notes: "",
      };
    } else {
      kg.people[person_id].descriptor = data.descriptor;
    }
  }
  return Object.keys(stored).length;
}
