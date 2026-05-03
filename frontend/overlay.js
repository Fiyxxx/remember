import { LocalState } from "./state.js";

// faceId → { el, x, y }  (x/y are the smoothed screen positions)
const cardPool = new Map();
const LERP = 0.1; // smoothing factor per frame — lower = smoother but laggier

function videoToScreen(vx, vy, videoEl) {
  const cW = videoEl.clientWidth;
  const cH = videoEl.clientHeight;
  const vW = videoEl.videoWidth;
  const vH = videoEl.videoHeight;
  const videoAR = vW / vH;
  const containerAR = cW / cH;
  let scale, ox, oy;
  if (videoAR > containerAR) {
    scale = cH / vH;
    ox = (cW - vW * scale) / 2;
    oy = 0;
  } else {
    scale = cW / vW;
    ox = 0;
    oy = (cH - vH * scale) / 2;
  }
  return { x: vx * scale + ox, y: vy * scale + oy };
}

function getOrCreateCard(id, targetX, targetY) {
  if (cardPool.has(id)) return cardPool.get(id);
  const el = document.createElement("div");
  el.className = "face-card";
  document.getElementById("viewport").appendChild(el);
  const entry = { el, x: targetX, y: targetY };
  cardPool.set(id, entry);
  return entry;
}

function removeStaleCards(activeIds) {
  for (const [id, { el }] of cardPool) {
    if (!activeIds.has(id)) {
      el.remove();
      cardPool.delete(id);
    }
  }
}

export function drawOverlay(canvas, videoEl) {
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;

  if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!videoEl.videoWidth) return;

  const activeIds = new Set(LocalState.activeFaces.map((f) => f.id));
  removeStaleCards(activeIds);

  for (const face of LocalState.activeFaces) {
    const { x, y, w, h } = face.bbox;
    const person = LocalState.knowledgeGraph?.people?.[face.id];

    const tr = videoToScreen(x + w, y, videoEl);
    const bl = videoToScreen(x, y + h, videoEl);
    const targetX = tr.x + 12;
    const targetY = tr.y + (bl.y - tr.y) / 2;

    const entry = getOrCreateCard(face.id, targetX, targetY);

    // Lerp current position toward target
    entry.x += (targetX - entry.x) * LERP;
    entry.y += (targetY - entry.y) * LERP;

    const color = face.matched ? "#6ee7b7" : "#FF6B6B";
    const name = person?.display_name || (face.matched ? face.id : "Unknown");
    const topics = person?.topics || [];
    const notes = person?.notes || "";
    const relationship = person?.relationship || "";
    const lastSeen = person?.last_seen ? formatTime(person.last_seen) : null;

    entry.el.style.cssText = `
      position: fixed;
      left: ${entry.x}px;
      top: ${entry.y}px;
      transform: translateY(-50%);
      max-width: 460px;
      z-index: 50;
      pointer-events: none;
    `;

    entry.el.innerHTML = `
      <div class="fc-inner" style="--accent:${color}">
        <div class="fc-header">
          <span class="fc-name">${esc(name)}</span>
          ${relationship ? `<span class="fc-relationship">${esc(relationship)}</span>` : ""}
        </div>
        ${topics.length > 0 ? `<div class="fc-topics">${topics.map((t) => `<span class="fc-tag">${esc(t)}</span>`).join("")}</div>` : ""}
        ${notes ? `<div class="fc-notes">${esc(truncate(notes, 300))}</div>` : ""}
        ${lastSeen ? `<div class="fc-time">last seen ${lastSeen}</div>` : ""}
      </div>
    `;
  }
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(s, max) {
  return s.length > max ? s.slice(0, max) + "…" : s;
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function startRenderLoop(canvas, videoEl) {
  function loop() {
    drawOverlay(canvas, videoEl);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
