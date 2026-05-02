# Remember Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete Remember frontend — real-time face detection with AR overlay, live speech subtitles, and AI query UI — using the existing stub files as the contract.

**Architecture:** A single-page vanilla JS app where all mutable state lives in `LocalState`. The canvas render loop reads only from `LocalState`; API responses write only to `LocalState`. These two things never communicate directly. Face detection runs on a 100ms `setInterval`; canvas drawing runs on `requestAnimationFrame`.

**Tech Stack:** Vanilla JS (ES modules), face-api.js (vladmandic CDN fork), HTML5 Canvas 2D, Web Speech API, `getUserMedia`.

---

## Pre-flight: Ambiguities Resolved

Before implementing, here are decisions made and gotchas caught in the stub audit:

| Issue | Decision |
|-------|----------|
| `drawOverlay(canvas)` stub vs spec `drawOverlay(canvas, videoEl)` | Use `(canvas, videoEl)` — video dimensions needed for coordinate sync |
| Stub comment says `SsdMobilenetv1` | Use `TinyFaceDetector` + `faceLandmark68TinyNet` (lighter, real-time, matches model file list) |
| `api.js` mocks return wrong shapes | Fix in Task 2: mocks must match real response contract |
| `queryAI` stub sends `{ transcript }` but spec says `{ query, knowledge_graph }` | Fix real fetch in Task 2 |
| `enrollPerson` can't write files from browser | Return descriptor + trigger JSON download |
| `known_faces.json` as local fallback | Load it in `app.js` when backend KG returns no people |
| `webkitSpeechRecognition` vs `SpeechRecognition` | Check both with `window.SpeechRecognition \|\| window.webkitSpeechRecognition` |
| Canvas buffer size vs CSS size | Set `canvas.width = videoEl.videoWidth` each frame in `drawOverlay` |
| Toast uses `display:none` but spec uses opacity transition | Switch toast to opacity + `.show` class in Task 7 |
| `app.js` missing `updatePerson`, `introducePerson` imports | Add in Task 6 |

---

## File Map

| File | Status | Work |
|------|--------|------|
| `frontend/face.js` | Stub | Full implementation |
| `frontend/overlay.js` | Stub | Full implementation |
| `frontend/speech.js` | Stub | Full implementation |
| `frontend/api.js` | Mock active (wrong shapes) | Fix mock shapes + real fetch bodies |
| `frontend/app.js` | Partial | Complete `onPause`, AI button, `showToast`, `renderChecklist`, add missing imports |
| `frontend/index.html` | Good shape | Add emoji to AI button, add `.hidden` to checklist |
| `frontend/style.css` | Good shape | Add `.hidden`, convert toast to opacity/class system |
| `frontend/known_faces.json` | `{ people: {} }` | No change (populated by enrollment) |
| `frontend/models/` | Empty | Manual download step (Task 1) |

---

## Task 1: Download face-api Model Files

**Complexity: Easy — but BLOCKING. Nothing works without this.**

**Files:**
- Populate: `frontend/models/` (6 files)

These must be served at `/models/` relative to the frontend root. When you run `npx serve frontend`, that means `http://localhost:3000/models/`.

- [ ] **Step 1: Download the 6 model files**

Go to: https://github.com/vladmandic/face-api/tree/master/model

Download these exact files into `frontend/models/`:
```
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model.bin
face_landmark_68_tiny_model-weights_manifest.json
face_landmark_68_tiny_model.bin
face_recognition_model-weights_manifest.json
face_recognition_model.bin
```

Or use curl (run from repo root):
```bash
BASE="https://raw.githubusercontent.com/vladmandic/face-api/master/model"
cd frontend/models
curl -O "$BASE/tiny_face_detector_model-weights_manifest.json"
curl -O "$BASE/tiny_face_detector_model.bin"
curl -O "$BASE/face_landmark_68_tiny_model-weights_manifest.json"
curl -O "$BASE/face_landmark_68_tiny_model.bin"
curl -O "$BASE/face_recognition_model-weights_manifest.json"
curl -O "$BASE/face_recognition_model.bin"
```

- [ ] **Step 2: Verify files exist**

```bash
ls frontend/models/
```

Expected output (6 files):
```
face_landmark_68_tiny_model-weights_manifest.json
face_landmark_68_tiny_model.bin
face_recognition_model-weights_manifest.json
face_recognition_model.bin
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model.bin
```

- [ ] **Step 3: Commit**

```bash
git add frontend/models/
git commit -m "chore: add face-api model weights"
```

---

## Task 2: Fix api.js — Contract Alignment

**Complexity: Easy**

**Files:**
- Modify: `frontend/api.js`

The stubs have mock shapes that don't match the agreed API contract. Fix mocks first so the rest of the app can test against correct data shapes. Also fix the real fetch bodies.

- [ ] **Step 1: Replace the entire api.js**

```js
import { LocalState } from "./state.js";

const BACKEND_URL = "http://localhost:8000";

// Set MOCKS_ACTIVE = true to run frontend without the backend
const MOCKS_ACTIVE = true;

export async function fetchKnowledgeGraph() {
  if (MOCKS_ACTIVE) {
    return {
      people: {
        alex_chen: {
          descriptor: new Array(128).fill(0),
          display_name: "Alex Chen",
          topics: ["machine learning", "hiking"],
          first_met: "2026-05-02",
          last_seen: "2026-05-02T10:00:00",
          notes: "demo seed person",
        },
      },
      agenda: [
        "10:00am — Demo face recognition to judges",
        "2:00pm — Integrate Gemini knowledge graph",
        "Send Q2 report by EOD",
        "Polish overlay UI before presentation",
      ],
    };
  }
  const res = await fetch(`${BACKEND_URL}/knowledge-graph`);
  if (!res.ok) throw new Error(`GET /knowledge-graph → ${res.status}`);
  return res.json();
}

// Called when speech pauses and a known person is in frame
// Returns: { person: <person object>, was_updated: boolean }
export async function updatePerson(personId, transcript) {
  if (MOCKS_ACTIVE) {
    return { person: LocalState.knowledgeGraph.people[personId] ?? null, was_updated: false };
  }
  const res = await fetch(`${BACKEND_URL}/update-person`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ person_id: personId, transcript }),
  });
  if (!res.ok) throw new Error(`POST /update-person → ${res.status}`);
  return res.json();
}

// Called when unknown person introduces themselves ("Hi I'm Sarah")
// Returns: { person_id: string, person: <person object> }
export async function introducePerson(tempId, name, descriptor) {
  if (MOCKS_ACTIVE) {
    const person_id = name.toLowerCase().replace(/\s+/g, "_");
    return {
      person_id,
      person: {
        descriptor: Array.from(descriptor),
        display_name: name,
        topics: [],
        first_met: new Date().toISOString().slice(0, 10),
        last_seen: new Date().toISOString(),
        notes: "",
      },
    };
  }
  const res = await fetch(`${BACKEND_URL}/introduce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ temp_id: tempId, name, descriptor: Array.from(descriptor) }),
  });
  if (!res.ok) throw new Error(`POST /introduce → ${res.status}`);
  return res.json();
}

// Called when user presses AI button and speaks a question
// Returns: { answer: string, checklist: string[] }
export async function queryAI(transcript) {
  if (MOCKS_ACTIVE) {
    return {
      answer: `[mock] You asked: "${transcript}"`,
      checklist: transcript.toLowerCase().includes("agenda")
        ? LocalState.knowledgeGraph.agenda
        : [],
    };
  }
  const res = await fetch(`${BACKEND_URL}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: transcript, knowledge_graph: LocalState.knowledgeGraph }),
  });
  if (!res.ok) throw new Error(`POST /query → ${res.status}`);
  return res.json();
}

export { BACKEND_URL };
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node --input-type=module < frontend/api.js 2>&1 || echo "syntax OK (import errors are expected in Node)"
```

Expected: either clean output or only "Cannot use import statement" — not a SyntaxError.

- [ ] **Step 3: Commit**

```bash
git add frontend/api.js
git commit -m "fix: align api.js mock shapes with backend contract"
```

---

## Task 3: Implement face.js

**Complexity: Hard — this is the riskiest component. Build and verify it before anything else.**

**Files:**
- Modify: `frontend/face.js`

face-api.js is loaded via CDN as a non-module script, so it sets `window.faceapi`. In ES modules, reference it via the global (`faceapi` or `window.faceapi`). The `startDetectionLoop` sets a 100ms interval — 10fps is enough for recognition, won't drain the CPU.

**Coordinate gotcha:** face-api returns bounding boxes in the video's native pixel resolution (e.g., 1280×720). The canvas CSS fills the viewport at a different size. Fix: set `canvas.width = videoEl.videoWidth` each frame in `drawOverlay` (done in Task 4). The `bbox` values stored in `LocalState.activeFaces` are always in video-native pixels.

- [ ] **Step 1: Replace face.js**

```js
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
  if (videoEl.readyState < 2) return; // video not ready yet

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

export async function enrollPerson(name, imagePath) {
  const img = await faceapi.fetchImage(imagePath);
  const detection = await faceapi
    .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks(true)
    .withFaceDescriptor();

  if (!detection) {
    console.warn(`[face] No face found in ${imagePath}`);
    return null;
  }

  const result = {
    name,
    descriptor: Array.from(detection.descriptor),
  };

  // Download descriptor as JSON — paste into known_faces.json or send to teammate
  const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.toLowerCase().replace(/\s+/g, "_")}_descriptor.json`;
  a.click();
  URL.revokeObjectURL(url);

  return result;
}
```

- [ ] **Step 2: Manual smoke test — open the browser console**

Start the dev server:
```bash
npx serve frontend
```

Open `http://localhost:3000` in Chrome. Open DevTools console. Expected console output:
```
[init] Loading face-api models...
[init] Models loaded.
[init] Fetching knowledge graph...
[init] Knowledge graph loaded: 1 people.
[init] Building face matcher...
[face] FaceMatcher built with 1 known face(s)
[init] Face matcher ready.
[init] Requesting webcam access...
[init] Webcam started.
[init] Starting face detection loop...
[init] Face detection loop running.
```

If you see `net::ERR_FILE_NOT_FOUND` for model files, Task 1 was not completed correctly.

If you see `faceapi is not defined`, the CDN script hasn't loaded yet — check the `<script defer>` order in `index.html`.

- [ ] **Step 3: Verify detection writes to LocalState**

In the browser console, after allowing webcam:
```js
LocalState.activeFaces
```

Expected after ~1 second with a face in frame: an array with at least one object like `{ id: "unknown_ab3f", bbox: {...}, descriptor: Float32Array(128), matched: false }`.

- [ ] **Step 4: Commit**

```bash
git add frontend/face.js
git commit -m "feat: implement face detection and recognition loop"
```

---

## Task 4: Implement overlay.js

**Complexity: Medium**

**Files:**
- Modify: `frontend/overlay.js`

The canvas buffer size (`canvas.width`, `canvas.height`) must equal the video's native resolution (`videoEl.videoWidth`, `videoEl.videoHeight`). CSS scales both the `<video>` and `<canvas>` elements visually to fill the viewport — the buffer coordinates stay in video-native pixel space. `drawOverlay` syncs the buffer size on every frame.

- [ ] **Step 1: Replace overlay.js**

```js
import { LocalState } from "./state.js";

export function drawOverlay(canvas, videoEl) {
  // Keep canvas buffer in sync with video native resolution
  if (canvas.width !== videoEl.videoWidth || canvas.height !== videoEl.videoHeight) {
    canvas.width = videoEl.videoWidth || canvas.width;
    canvas.height = videoEl.videoHeight || canvas.height;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const face of LocalState.activeFaces) {
    const { x, y, w, h } = face.bbox;
    const person = LocalState.knowledgeGraph.people[face.id];

    // Bounding box
    ctx.strokeStyle = face.matched ? "#00FF88" : "#FF6B6B";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Info card — clamp above the face box, never above y=0
    const cardW = 230;
    const cardH = 75;
    const cardY = Math.max(0, y - cardH - 6);
    const cardX = Math.min(x, canvas.width - cardW - 4);

    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 6);
    ctx.fill();

    // Name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 14px Inter, system-ui, sans-serif";
    ctx.fillText(
      person?.display_name || (face.matched ? face.id : "Unknown"),
      cardX + 10,
      cardY + 22
    );

    // Topics
    if (person?.topics?.length > 0) {
      ctx.fillStyle = "#AAAAAA";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText(person.topics.slice(0, 2).join(" · "), cardX + 10, cardY + 40);
    }

    // Last seen
    if (person?.last_seen) {
      ctx.fillStyle = "#666666";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.fillText("Last seen: " + formatTime(person.last_seen), cardX + 10, cardY + 58);
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function formatTime(isoString) {
  try {
    return new Date(isoString).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

export function startRenderLoop(canvas, videoEl) {
  function loop() {
    drawOverlay(canvas, videoEl);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
```

- [ ] **Step 2: Manual smoke test**

Reload the page. With a face in frame you should see:
- A green bounding box around your face (red if unmatched; green if matched)
- A dark rounded-corner card above the box with "Unknown" (or name if matched)
- No console errors about `canvas.width` being 0

If the box is in the wrong position or scaled weirdly, check that `canvas.width` and `videoEl.videoWidth` are equal in the console.

- [ ] **Step 3: Commit**

```bash
git add frontend/overlay.js
git commit -m "feat: implement canvas overlay with face cards"
```

---

## Task 5: Implement speech.js

**Complexity: Medium**

**Files:**
- Modify: `frontend/speech.js`

`SpeechRecognition` is `webkit`-prefixed in Chrome. The recognition fires `onend` when it stops (it always stops after a few seconds of silence) — restart it in `onend` to maintain continuous listening. Accumulate `final` transcripts across events within a 1.5s pause window so multi-sentence speech gets sent as one chunk.

- [ ] **Step 1: Replace speech.js**

```js
import { LocalState } from "./state.js";

export function startSpeechRecognition({ onTranscript, onPause }) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn("[speech] SpeechRecognition not supported in this browser");
    return;
  }

  const recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  let pauseTimer = null;
  let accumulatedFinal = "";

  recognition.onresult = (event) => {
    let interim = "";
    let final = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        final += event.results[i][0].transcript;
      } else {
        interim += event.results[i][0].transcript;
      }
    }

    LocalState.subtitles = interim || final;
    onTranscript(LocalState.subtitles);

    if (final) {
      accumulatedFinal += " " + final;
      clearTimeout(pauseTimer);
      pauseTimer = setTimeout(() => {
        const text = accumulatedFinal.trim();
        accumulatedFinal = "";
        LocalState.subtitles = "";
        onTranscript("");
        if (text) onPause(text);
      }, 1500);
    }
  };

  recognition.onerror = (event) => {
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      console.warn("[speech] Microphone permission denied");
      return;
    }
    console.warn("[speech] Error:", event.error);
  };

  recognition.onend = () => {
    // Chrome stops recognition on silence — restart to maintain continuous listening
    if (LocalState.isListening) {
      try {
        recognition.start();
      } catch {
        // Already started — ignore
      }
    }
  };

  recognition.start();
  LocalState.isListening = true;
  console.log("[speech] Recognition started");
}
```

- [ ] **Step 2: Manual smoke test**

Reload the page. Allow microphone when prompted. Speak a sentence. Expected:
- Subtitles bar at the bottom shows live transcript as you speak
- After 1.5s of silence, console logs `[speech] Pause: <what you said>`
- Subtitles bar clears after the pause

If nothing happens, check DevTools → Application → Permissions for microphone.

- [ ] **Step 3: Commit**

```bash
git add frontend/speech.js
git commit -m "feat: implement continuous speech recognition with pause detection"
```

---

## Task 6: Complete app.js — onPause Logic and AI Button

**Complexity: Medium**

**Files:**
- Modify: `frontend/app.js`

The stub's `onPause` just logs. It needs the full logic:
1. Check if speech contains a name introduction → call `introducePerson`
2. Otherwise, if a known face is in frame → call `updatePerson`

The AI button currently reads `LocalState.subtitles` (whatever was last transcribed), but it should launch a fresh one-shot recognition query. Also fix `showToast` to use CSS classes and `renderChecklist` to add checkboxes.

- [ ] **Step 1: Replace app.js**

```js
import { LocalState } from "./state.js";
import { loadModels, buildFaceMatcher, startDetectionLoop } from "./face.js";
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

  // 2. Fetch knowledge graph (falls back to empty KG silently)
  console.log("[init] Fetching knowledge graph...");
  try {
    const kg = await fetchKnowledgeGraph();
    LocalState.knowledgeGraph = kg;
    console.log("[init] Knowledge graph loaded:", Object.keys(kg.people).length, "people.");
  } catch (err) {
    console.warn("[init] Backend unreachable — using empty knowledge graph.", err);
  }

  // 3. Build face matcher
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

  // 5. Start detection loop
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

  // AI button — one-shot query
  aiBtn?.addEventListener("click", () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast("Speech not supported");
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
```

- [ ] **Step 2: Manual smoke test — introduction flow**

With mocks active (`MOCKS_ACTIVE = true` in api.js), speak "Hi, I'm Sarah" with a face in frame. Expected:
- Toast shows "✦ Remembered Sarah"
- Console logs `[speech] Introduction detected: Sarah`
- `LocalState.knowledgeGraph.people` now contains a `sarah` key

- [ ] **Step 3: Manual smoke test — AI button**

Click the AI button, speak "What's on the agenda?". Expected:
- Toast shows "Listening..." then "Thinking..." then the mock answer
- Checklist panel appears on the right (mock returns agenda items when "agenda" is in query)

- [ ] **Step 4: Commit**

```bash
git add frontend/app.js
git commit -m "feat: implement onPause logic, AI button, and toast/checklist UI"
```

---

## Task 7: Fix index.html and style.css

**Complexity: Easy**

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/style.css`

Three changes needed:
1. Add `.hidden` class (checklist starts hidden)
2. Convert toast from `display:none` to `opacity` + `.show` class (enables CSS transition)
3. Add emoji to AI button label

- [ ] **Step 1: Update index.html — add `.hidden` to checklist and emoji to button**

In `index.html`, change:
```html
    <div id="checklist">
```
to:
```html
    <div id="checklist" class="hidden">
```

And change:
```html
    <button id="ai-btn">Ask AI</button>
```
to:
```html
    <button id="ai-btn">🎙 Ask AI</button>
```

- [ ] **Step 2: Update style.css — add `.hidden`, fix toast to use opacity transition**

At the end of `style.css`, append:

```css
.hidden {
  display: none !important;
}

#checklist-items li {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

#checklist-items input[type="checkbox"] {
  accent-color: #6ee7b7;
  cursor: pointer;
}
```

Then find the `#toast` rule and replace it entirely:

```css
#toast {
  position: fixed;
  top: 1.2rem;
  right: 1.2rem;
  max-width: 320px;
  background: rgba(20, 20, 20, 0.92);
  color: #fff;
  font-size: 0.95rem;
  padding: 0.8rem 1.2rem;
  border-radius: 0.75rem;
  border-left: 3px solid #6ee7b7;
  z-index: 100;
  word-wrap: break-word;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

#toast.show {
  opacity: 1;
  pointer-events: auto;
}
```

- [ ] **Step 3: Manual smoke test**

Reload. Checklist should be invisible on load. Click AI button and say "agenda" — checklist should appear. Toast should fade in and out smoothly when shown.

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html frontend/style.css
git commit -m "fix: hidden class for checklist, toast opacity transition, ai-btn emoji"
```

---

## Task 8: Enrollment Script

**Complexity: Medium — run the night before the demo**

**Files:**
- No code changes — `enrollPerson` is already implemented in `face.js`
- Add enrollment photos: `frontend/enrollment/` (create directory)

This task documents exactly how to pre-enrol known people so face recognition works at the demo.

- [ ] **Step 1: Create enrollment directory and add photo**

```bash
mkdir -p frontend/enrollment
# Copy a clear, well-lit photo of each known person:
# frontend/enrollment/alex.jpg
# frontend/enrollment/sarah.jpg  (etc.)
```

Photo requirements:
- Clear frontal face, good lighting
- JPEG or PNG
- At least 200×200px

- [ ] **Step 2: Run enrollment from the browser console**

Start the dev server:
```bash
npx serve frontend
```

Open `http://localhost:3000`. In DevTools console, import the function and run:
```js
// Import face.js module context is already loaded — call via the global
// (face.js exports are not on window, so use the workaround below)
const { enrollPerson } = await import('./face.js')
const result = await enrollPerson('Alex Chen', '/enrollment/alex.jpg')
console.log('Descriptor length:', result.descriptor.length) // should be 128
```

A JSON file (`alex_chen_descriptor.json`) will download automatically.

- [ ] **Step 3: Paste descriptor into known_faces.json (local fallback) and send to teammate**

Open the downloaded JSON. The structure is `{ name: "Alex Chen", descriptor: [...128 floats] }`.

Update `frontend/known_faces.json`:
```json
{
  "people": {
    "alex_chen": {
      "descriptor": [/* paste the 128 floats here */],
      "display_name": "Alex Chen",
      "topics": ["machine learning", "hiking"],
      "first_met": "2026-05-02",
      "last_seen": null,
      "notes": ""
    }
  }
}
```

Also send the descriptor array to your teammate. They'll seed it into the backend KG.

- [ ] **Step 4: Update api.js mock to use real descriptor**

In `frontend/api.js`, replace the `alex_chen` mock descriptor (128 zeros) with the real descriptor you just enrolled. This makes mock mode test actual face matching:

```js
// In fetchKnowledgeGraph mock, replace:
descriptor: new Array(128).fill(0),
// with the real 128-float array from your enrollment JSON
```

- [ ] **Step 5: Load known_faces.json as fallback in app.js**

In `app.js`, after the failed backend fetch (in the `catch` block), add:

```js
  } catch (err) {
    console.warn("[init] Backend unreachable — trying local known_faces.json...", err);
    try {
      const res = await fetch("/known_faces.json");
      const local = await res.json();
      LocalState.knowledgeGraph = local;
      console.log("[init] Loaded local known_faces.json:", Object.keys(local.people).length, "people.");
    } catch {
      console.warn("[init] No local fallback either — using empty KG.");
    }
  }
```

- [ ] **Step 6: Test face recognition end-to-end**

With real descriptor in `known_faces.json`, reload the page. Stand in front of the webcam. Expected:
- Bounding box turns **green** (not red)
- Card shows "Alex Chen" (not "Unknown")
- Console logs FaceMatcher found a match

- [ ] **Step 7: Commit**

```bash
git add frontend/known_faces.json frontend/app.js frontend/api.js
git commit -m "feat: enrollment workflow and local known_faces fallback"
```

---

## Task 9: Backend Integration Switch

**Complexity: Easy — when teammate's backend is ready**

**Files:**
- Modify: `frontend/api.js` (one line change)

When your teammate's backend is running at `http://localhost:8000`:

- [ ] **Step 1: Disable mocks**

In `frontend/api.js`, change:
```js
const MOCKS_ACTIVE = true;
```
to:
```js
const MOCKS_ACTIVE = false;
```

- [ ] **Step 2: Verify integration**

```bash
curl http://localhost:8000/knowledge-graph
```

Expected: JSON with `people` and `agenda` keys matching the agreed shape.

Then reload the browser. Expected: `[init] Knowledge graph loaded: N people.` (where N > 0 if teammate seeded Alex Chen).

- [ ] **Step 3: Commit**

```bash
git add frontend/api.js
git commit -m "chore: switch api.js to live backend"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|-------------|------|
| Webcam feed full-screen | Already in HTML/CSS (Task 7 polish) |
| Face detection + bounding boxes | Task 3 + 4 |
| Known vs unknown matching + info cards | Task 3 (`buildFaceMatcher`) + Task 4 (`drawOverlay`) |
| Web Speech API subtitles | Task 5 |
| "Remembered" toast notification | Task 6 (`showToast`) |
| AI button + voice query | Task 6 (AI button handler) |
| Checklist UI renderer | Task 6 (`renderChecklist`) + Task 7 (`.hidden`, checkboxes) |
| `LocalState` as single source of truth | Tasks 3/4/5/6 all write to and read from `LocalState` only |
| Backend contract — 3 API functions | Task 2 |
| App doesn't crash if backend unreachable | Task 2 (`MOCKS_ACTIVE`), Task 6 (try/catch), Task 8 (fallback) |
| `buildFaceMatcher` rebuilt after `/introduce` | Task 6 (`onPause` intro branch) |
| Canvas exactly matches video dimensions | Task 4 (`drawOverlay` syncs buffer) |
| Enrollment workflow | Task 8 |

All requirements covered. No gaps found.

### Placeholder Scan

No TBD, TODO, or incomplete steps found. All code blocks are complete.

### Type Consistency

- `LocalState.activeFaces[i].bbox` → `{ x, y, w, h }` — used consistently in `face.js` (Task 3) and `overlay.js` (Task 4) ✓
- `LocalState.activeFaces[i].descriptor` → `Float32Array` — used in `face.js` and passed as `Array.from(descriptor)` to `introducePerson` ✓
- `introducePerson` returns `{ person_id, person }` — mock in Task 2 matches usage in Task 6 ✓
- `updatePerson` returns `{ person, was_updated }` — mock in Task 2 matches usage in Task 6 ✓
- `queryAI` returns `{ answer, checklist }` — mock in Task 2 matches usage in Task 6 ✓
- `buildFaceMatcher(kg)` — called with `LocalState.knowledgeGraph` in Tasks 3 and 6 ✓
- `drawOverlay(canvas, videoEl)` — defined in Task 4, called in `startRenderLoop` in Task 4 ✓
