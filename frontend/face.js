/**
 * face.js — face detection and recognition via face-api.js (vladmandic fork)
 */

export async function loadModels() {
  // TODO: Load SsdMobilenetv1, FaceLandmark68Net, FaceRecognitionNet from /models
}

export function buildFaceMatcher(kg) {
  // TODO: Build a FaceMatcher from descriptors stored in kg.people
  // Returns a FaceMatcher instance or null if no known faces
}

export function startDetectionLoop(videoEl) {
  // TODO: Run faceapi.detectAllFaces on videoEl every frame
  // Updates LocalState.activeFaces with { detection, match, personId, label }
}

export async function enrollPerson(name, imagePath) {
  // TODO: Load image, detect face, extract descriptor, save to known_faces.json
}
