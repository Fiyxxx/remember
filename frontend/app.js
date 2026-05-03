import { LocalState } from "./state.js";

const MIC_ON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:block">
  <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V20H9v2h6v-2h-2v-2.08A7 7 0 0 0 19 11h-2z"/>
</svg>`;

const MIC_OFF_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="display:block">
  <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3 3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.1-5.3-5.1H5c0 3.41 2.72 6.23 6 6.72V20H9v2h6v-2h-2v-2.28c.91-.13 1.77-.45 2.54-.9L19.73 21 21 19.73 4.27 3z"/>
</svg>`;
import { loadModels, buildFaceMatcher, startDetectionLoop, enrollFromVideo } from "./face.js";
import { startRenderLoop } from "./overlay.js";
import { startSpeechRecognition } from "./speech.js";
import { fetchKnowledgeGraph, queryAI, updatePerson, introducePerson } from "./api.js";

async function init() {
  const videoEl = document.getElementById("webcam");
  const canvas = document.getElementById("overlay");
  const subtitlesEl = document.getElementById("subtitles");
  const aiBtn = document.getElementById("ai-btn");

  // 1. Load face-api models
  await loadModels();

  // 2. Fetch knowledge graph from backend
  try {
    LocalState.knowledgeGraph = await fetchKnowledgeGraph();
    console.log("[init] KG loaded:", Object.keys(LocalState.knowledgeGraph.people).length, "people");
  } catch (err) {
    console.warn("[init] Backend unreachable — starting with empty KG:", err.message);
  }

  // 3. Build face matcher
  buildFaceMatcher(LocalState.knowledgeGraph);

  // 4. Start webcam
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = stream;
    await new Promise((resolve) => (videoEl.onloadedmetadata = resolve));
    videoEl.play();
  } catch (err) {
    console.error("[init] Webcam access denied:", err);
    return;
  }

  // 5. Start face detection + render loops
  startDetectionLoop(videoEl);
  startRenderLoop(canvas, videoEl);

  // 6. Start speech recognition — keep control object to pause/resume for AI button
  const speech = startSpeechRecognition({
    onTranscript: (text) => {
      LocalState.subtitles = text;
      if (subtitlesEl) subtitlesEl.textContent = text;
    },
    onPause: async (finalText) => {
      const introMatch = finalText.match(/(?:i'?m|my name is|i am)\s+([A-Z][a-z]+)/i);
      const unknownFace = LocalState.activeFaces.find((f) => !f.matched);

      if (introMatch && unknownFace) {
        const name = introMatch[1];
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

  // 7. AI button — pause continuous mic, run one-shot query, then resume
  const listeningOverlay = document.getElementById("listening-overlay");

  aiBtn?.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast("Speech not supported in this browser"); return; }

    speech.pause();
    playChime("listen");
    listeningOverlay?.classList.add("show");

    const oneShot = new SR();
    oneShot.onresult = async (event) => {
      const query = event.results[0][0].transcript;
      listeningOverlay?.classList.remove("show");
      playChime("think");
      showToast("Thinking...");
      try {
        const result = await queryAI(query);
        showToast(result.answer || "[no answer]", 5000);
        if (result.checklist?.length > 0) renderChecklist(result.checklist);
      } catch (err) {
        console.warn("[ai] queryAI failed:", err);
        showToast("AI unavailable");
      }
    };
    oneShot.onerror = () => {
      listeningOverlay?.classList.remove("show");
      showToast("Could not hear you");
    };
    oneShot.onend = () => speech.resume();
    oneShot.start();
  });

  // 8. Mute button
  const muteBtn = document.getElementById("mute-btn");
  let muted = false;
  if (muteBtn) muteBtn.textContent = "Mute";
  muteBtn?.addEventListener("click", () => {
    muted = !muted;
    if (muted) {
      speech.pause();
      muteBtn.classList.add("muted");
      muteBtn.textContent = "Unmute";
    } else {
      speech.resume();
      muteBtn.classList.remove("muted");
      muteBtn.textContent = "Mute";
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && e.target === document.body) {
      e.preventDefault();
      muteBtn?.click();
    }
  });

  // 9. Enroll button — only allowed when an unrecognised face is in frame
  document.getElementById("enroll-btn")?.addEventListener("click", () => {
    if (!LocalState.activeFaces.some((f) => !f.matched)) {
      showToast("No unknown face in frame — look at the camera first");
      return;
    }
    enrollUser(videoEl);
  });

  // 10. Console helper: enroll('Han Sheng')
  window.enroll = (name) => enrollUser(videoEl, name);

  console.log("[init] Remember is ready.");
}

async function enrollUser(videoEl, name) {
  const resolvedName = name?.trim() || prompt("Enter your name:")?.trim();
  if (!resolvedName) return;

  showToast("Capturing face...");
  const captured = await enrollFromVideo(videoEl, resolvedName);
  if (!captured) {
    showToast("No face detected — look at the camera and try again");
    return;
  }

  try {
    const result = await introducePerson(captured.person_id, resolvedName, captured.descriptor);
    LocalState.knowledgeGraph.people[result.person_id] = result.person;
    buildFaceMatcher(LocalState.knowledgeGraph);
    showToast("✦ Enrolled " + resolvedName);
    console.log("[enroll] Synced to backend:", result.person_id);
  } catch (err) {
    console.warn("[enroll] Backend sync failed:", err);
    showToast("Enrolled locally — backend sync failed");
    LocalState.knowledgeGraph.people[captured.person_id] = {
      descriptor: captured.descriptor,
      display_name: resolvedName,
      topics: [],
      first_met: new Date().toISOString().slice(0, 10),
      last_seen: null,
      notes: "",
    };
    buildFaceMatcher(LocalState.knowledgeGraph);
  }
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
  container.classList.remove("fade-in");
  void container.offsetWidth; // force reflow so animation restarts
  container.classList.add("fade-in");
}

function playChime(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);

    if (type === "listen") {
      // Two ascending soft tones — "open / ready"
      [[440, 0, 0.12], [660, 0.13, 0.12]].forEach(([freq, start, dur]) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0, ctx.currentTime + start);
        g.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02);
        g.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur + 0.05);
      });
    } else {
      // Single descending soft tone — "received / processing"
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.linearRampToValueAtTime(360, ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.22);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // AudioContext unavailable — silent fail
  }
}

window.addEventListener("DOMContentLoaded", init);
