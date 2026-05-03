import { LocalState } from "./state.js";

const cardPool = new Map();
const LERP = 0.12;
const CARD_OFFSET_X = 18;
const EXIT_DURATION = 250;

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

function lerp(a, b, t) {
  return a + (b - a) * t;
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

function contentHash(face, person) {
  const name = person?.display_name || (face.matched ? face.id : "Unknown");
  const topics = (person?.topics || []).join(",");
  const notes = person?.notes || "";
  const rel = person?.relationship || "";
  const ls = person?.last_seen || "";
  return `${name}|${topics}|${notes}|${rel}|${ls}`;
}

function buildCardHTML(face, person) {
  const name = person?.display_name || (face.matched ? face.id : "Unknown");
  const topics = person?.topics || [];
  const notes = person?.notes || "";
  const relationship = person?.relationship || "";
  const lastSeen = person?.last_seen ? formatTime(person.last_seen) : null;

  return `
    <div class="fc-inner">
      <div class="fc-header">
        <span class="fc-name">${esc(name)}</span>
        ${relationship ? `<span class="fc-relationship">${esc(relationship)}</span>` : ""}
      </div>
      ${topics.length > 0 ? `<div class="fc-topics">${topics.map((t) => `<span class="fc-tag">${esc(t)}</span>`).join("")}</div>` : ""}
      ${notes ? `<div class="fc-notes">${esc(truncate(notes, 280))}</div>` : ""}
      ${lastSeen ? `<div class="fc-time">Last seen ${lastSeen}</div>` : ""}
    </div>
  `;
}

function createCard(id, targetX, targetY, face, person) {
  const el = document.createElement("div");
  el.className = "face-card";

  const innerEl = document.createElement("div");
  innerEl.className = "fc-content fc-enter";
  innerEl.innerHTML = buildCardHTML(face, person).trim();
  el.appendChild(innerEl);

  document.getElementById("viewport").appendChild(el);

  const entry = {
    el,
    innerEl,
    smoothX: targetX,
    smoothY: targetY,
    targetX,
    targetY,
    faceScreenX: targetX,
    faceScreenY: targetY,
    smoothFaceX: targetX,
    smoothFaceY: targetY,
    state: "entering",
    contentHash: contentHash(face, person),
    opacity: 0,
  };

  void innerEl.offsetHeight;
  innerEl.classList.remove("fc-enter");
  innerEl.classList.add("fc-visible");
  entry.state = "visible";

  cardPool.set(id, entry);
  return entry;
}

function startExit(id, entry) {
  if (entry.state === "exiting") return;
  entry.state = "exiting";
  entry.innerEl.classList.remove("fc-visible");
  entry.innerEl.classList.add("fc-exit");

  setTimeout(() => {
    if (entry.state === "exiting") {
      entry.el.remove();
      cardPool.delete(id);
    }
  }, EXIT_DURATION + 50);
}

function cancelExit(entry) {
  entry.state = "visible";
  entry.innerEl.classList.remove("fc-exit", "fc-enter");
  entry.innerEl.classList.add("fc-visible");
}

function drawConnectorLines(ctx, dpr) {
  for (const [, entry] of cardPool) {
    if (entry.opacity < 0.01) continue;

    const fx = entry.smoothFaceX * dpr;
    const fy = entry.smoothFaceY * dpr;
    const cx = entry.smoothX * dpr;
    const cy = entry.smoothY * dpr;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(160, 163, 175, ${0.4 * entry.opacity})`;
    ctx.lineWidth = 1 * dpr;

    ctx.moveTo(fx, fy);
    ctx.lineTo(cx, fy);
    ctx.lineTo(cx, cy);

    ctx.stroke();
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

  for (const [id, entry] of cardPool) {
    if (!activeIds.has(id) && entry.state !== "exiting") {
      startExit(id, entry);
    }
  }

  for (const face of LocalState.activeFaces) {
    const { x, y, w, h } = face.bbox;
    const person = LocalState.knowledgeGraph?.people?.[face.id];

    const faceRight = videoToScreen(x + w, y + h / 2, videoEl);
    const faceCenter = videoToScreen(x + w / 2, y + h / 2, videoEl);
    const targetX = faceRight.x + CARD_OFFSET_X;
    const targetY = faceCenter.y;

    let entry = cardPool.get(face.id);

    if (entry) {
      if (entry.state === "exiting") {
        cancelExit(entry);
      }
      entry.targetX = targetX;
      entry.targetY = targetY;
      entry.faceScreenX = faceRight.x;
      entry.faceScreenY = faceCenter.y;

      const hash = contentHash(face, person);
      if (hash !== entry.contentHash) {
        entry.contentHash = hash;
        entry.innerEl.innerHTML = buildCardHTML(face, person).trim();
      }
    } else {
      entry = createCard(face.id, targetX, targetY, face, person);
      entry.faceScreenX = faceRight.x;
      entry.faceScreenY = faceCenter.y;
    }

    entry.smoothX = lerp(entry.smoothX, entry.targetX, LERP);
    entry.smoothY = lerp(entry.smoothY, entry.targetY, LERP);
    entry.smoothFaceX = lerp(entry.smoothFaceX, entry.faceScreenX, LERP);
    entry.smoothFaceY = lerp(entry.smoothFaceY, entry.faceScreenY, LERP);

    const targetOpacity = entry.state === "exiting" ? 0 : 1;
    entry.opacity = lerp(entry.opacity, targetOpacity, 0.15);

    entry.el.style.transform = `translate3d(${entry.smoothX}px, ${entry.smoothY}px, 0) translateY(-50%)`;
  }

  for (const [, entry] of cardPool) {
    if (entry.state === "exiting") {
      entry.opacity = lerp(entry.opacity, 0, 0.15);
    }
  }

  drawConnectorLines(ctx, dpr);
}

export function startRenderLoop(canvas, videoEl) {
  function loop() {
    drawOverlay(canvas, videoEl);
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}
