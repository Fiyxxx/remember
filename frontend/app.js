import { LocalState } from "./state.js";
import { loadModels, buildFaceMatcher, startDetectionLoop, enrollFromVideo, loadEnrolledDescriptors } from "./face.js";
import { startRenderLoop } from "./overlay.js";
import { startSpeechRecognition } from "./speech.js";
import { fetchKnowledgeGraph, queryAI, updatePerson, introducePerson } from "./api.js";

async function init() {
  const videoEl = document.getElementById("webcam");
  const canvas = document.getElementById("overlay");
  const subtitlesEl = document.getElementById("subtitles");
  const aiBtn = document.getElementById("ai-btn");

  // 1. Load face-api models
  console.log("[init] Loading face-api models...");
  await loadModels();
  console.log("[init] Models loaded.");

  // 2. Fetch knowledge graph — falls back gracefully if backend is unreachable
  console.log("[init] Fetching knowledge graph...");
  try {
    const kg = await fetchKnowledgeGraph();
    LocalState.knowledgeGraph = kg;
    console.log("[init] Knowledge graph loaded:", Object.keys(kg.people).length, "people.");
  } catch (err) {
    console.warn("[init] Backend unreachable — trying local known_faces.json...", err);
    try {
      const res = await fetch("/known_faces.json");
      const local = await res.json();
      LocalState.knowledgeGraph = local;
      console.log("[init] Loaded local known_faces.json:", Object.keys(local.people).length, "people.");
    } catch {
      console.warn("[init] No local fallback — using empty KG.");
    }
  }

  // 3. Merge any locally enrolled descriptors, then build face matcher
  const enrolledCount = loadEnrolledDescriptors(LocalState.knowledgeGraph);
  if (enrolledCount > 0) console.log("[init] Loaded", enrolledCount, "enrolled descriptor(s) from localStorage");
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
    onPause: async (finalText) => {
      console.log("[speech] Pause:", finalText);

      // Check for self-introduction: "I'm Sarah", "My name is Alex", "I am Chris"
      const introMatch = finalText.match(/(?:i'?m|my name is|i am)\s+([A-Z][a-z]+)/i);
      const unknownFace = LocalState.activeFaces.find((f) => !f.matched);

      if (introMatch && unknownFace) {
        const name = introMatch[1];
        console.log("[speech] Introduction detected:", name);
        try {
          const result = await introducePerson(unknownFace.id, name, unknownFace.descriptor);
          LocalState.knowledgeGraph.people[result.person_id] = result.person;
          buildFaceMatcher(LocalState.knowledgeGraph);
          showToast("✦ Remembered " + (result.person.display_name || name));
        } catch (err) {
          console.warn("[speech] introducePerson failed:", err);
        }
        return;
      }

      // Otherwise update a known face in frame
      const knownFace = LocalState.activeFaces.find((f) => f.matched);
      if (knownFace) {
        try {
          const result = await updatePerson(knownFace.id, finalText);
          if (result.was_updated && result.person) {
            LocalState.knowledgeGraph.people[knownFace.id] = result.person;
            showToast("✦ Remembered");
          }
        } catch (err) {
          console.warn("[speech] updatePerson failed:", err);
        }
      }
    },
  });
  console.log("[init] Speech recognition started.");

  // AI button — one-shot voice query
  aiBtn?.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast("Speech not supported in this browser");
      return;
    }
    showToast("Listening...");
    const oneShot = new SR();
    oneShot.onresult = async (event) => {
      const query = event.results[0][0].transcript;
      showToast("Thinking...");
      try {
        const result = await queryAI(query);
        showToast(result.answer || "[no answer]");
        if (result.checklist?.length > 0) {
          LocalState.checklistItems = result.checklist;
          LocalState.checklistVisible = true;
          renderChecklist(result.checklist);
        }
      } catch (err) {
        console.warn("[ai] queryAI failed:", err);
        showToast("AI unavailable");
      }
    };
    oneShot.onerror = () => showToast("Could not hear you");
    oneShot.start();
  });

  // Enroll button
  const enrollBtn = document.getElementById("enroll-btn");
  enrollBtn?.addEventListener("click", async () => {
    const name = prompt("Enter your name:");
    if (!name?.trim()) return;
    showToast("Capturing face...");
    const result = await enrollFromVideo(videoEl, name.trim());
    if (!result) {
      showToast("No face detected — look at the camera and try again");
      return;
    }
    LocalState.knowledgeGraph.people[result.person_id] = {
      descriptor: result.descriptor,
      display_name: name.trim(),
      topics: [],
      first_met: new Date().toISOString().slice(0, 10),
      last_seen: null,
      notes: "",
    };
    buildFaceMatcher(LocalState.knowledgeGraph);
    showToast("✦ Enrolled " + name.trim());
  });

  // Console helper: window.enroll('Han Sheng')
  window.enroll = async (name) => {
    if (!name) { console.log("Usage: enroll('Your Name')"); return; }
    const result = await enrollFromVideo(videoEl, name);
    if (!result) { console.warn("[enroll] No face detected"); return; }
    LocalState.knowledgeGraph.people[result.person_id] = {
      descriptor: result.descriptor,
      display_name: name,
      topics: [],
      first_met: new Date().toISOString().slice(0, 10),
      last_seen: null,
      notes: "",
    };
    buildFaceMatcher(LocalState.knowledgeGraph);
    showToast("✦ Enrolled " + name);
    console.log("[enroll] Done:", result.person_id);
  };

  console.log("[init] Remember is ready.");
}

function showToast(message, duration = 2500) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toast._hideTimer);
  toast._hideTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

function renderChecklist(items) {
  const ul = document.getElementById("checklist-items");
  const container = document.getElementById("checklist");
  if (!ul || !container) return;
  ul.innerHTML = items
    .map((item) => `<li><label><input type="checkbox"> ${item}</label></li>`)
    .join("");
  container.classList.remove("hidden");
}

window.addEventListener("DOMContentLoaded", init);
