import { LocalState } from "./state.js";
import { loadModels, buildFaceMatcher, startDetectionLoop } from "./face.js";
import { startRenderLoop } from "./overlay.js";
import { startSpeechRecognition } from "./speech.js";
import { fetchKnowledgeGraph, queryAI } from "./api.js";

export async function init() {
  const videoEl = document.getElementById("webcam");
  const canvas = document.getElementById("overlay");
  const subtitlesEl = document.getElementById("subtitles");
  const aiBtn = document.getElementById("ai-btn");

  // 1. Load face-api models
  console.log("[init] Loading face-api models...");
  await loadModels();
  console.log("[init] Models loaded.");

  // 2. Fetch knowledge graph from backend
  console.log("[init] Fetching knowledge graph...");
  try {
    const kg = await fetchKnowledgeGraph();
    LocalState.knowledgeGraph = kg;
    console.log("[init] Knowledge graph loaded:", Object.keys(kg.people).length, "people.");
  } catch (err) {
    console.warn("[init] Backend unreachable — using empty knowledge graph.", err);
  }

  // 3. Build face matcher from knowledge graph
  console.log("[init] Building face matcher...");
  buildFaceMatcher(LocalState.knowledgeGraph);
  console.log("[init] Face matcher ready.");

  // 4. Start webcam
  console.log("[init] Requesting webcam access...");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = stream;
    await new Promise((resolve) => (videoEl.onloadedmetadata = resolve));
    videoEl.play();
    console.log("[init] Webcam started.");
  } catch (err) {
    console.error("[init] Webcam access denied:", err);
    return;
  }

  // 5. Start face detection loop
  console.log("[init] Starting face detection loop...");
  startDetectionLoop(videoEl);
  console.log("[init] Face detection loop running.");

  // 6. Start render loop
  console.log("[init] Starting render loop...");
  startRenderLoop(canvas, videoEl);
  console.log("[init] Render loop running.");

  // 7. Start speech recognition
  console.log("[init] Starting speech recognition...");
  startSpeechRecognition({
    onTranscript: (text) => {
      LocalState.subtitles = text;
      if (subtitlesEl) subtitlesEl.textContent = text;
    },
    onPause: (finalText) => {
      console.log("[speech] Pause detected:", finalText);
    },
  });
  console.log("[init] Speech recognition started.");

  // AI query button
  aiBtn?.addEventListener("click", async () => {
    const transcript = LocalState.subtitles;
    if (!transcript) return;
    console.log("[ai] Querying with:", transcript);
    const result = await queryAI(transcript);
    showToast(result.response);
    if (LocalState.checklistItems) {
      LocalState.checklistItems = result.checklist || [];
      renderChecklist(LocalState.checklistItems);
    }
  });

  console.log("[init] Remember is ready.");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => (toast.style.display = "none"), 4000);
}

function renderChecklist(items) {
  const ul = document.getElementById("checklist-items");
  const container = document.getElementById("checklist");
  if (!ul || !container) return;
  ul.innerHTML = items.map((i) => `<li>${i}</li>`).join("");
  container.style.display = items.length ? "block" : "none";
}

window.addEventListener("DOMContentLoaded", init);
