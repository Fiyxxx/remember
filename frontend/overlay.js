import { LocalState } from "./state.js";

export function drawOverlay(canvas, videoEl) {
  const dpr = window.devicePixelRatio || 1;
  const displayW = canvas.clientWidth;
  const displayH = canvas.clientHeight;

  // Buffer at physical pixel resolution so text is sharp on HiDPI screens
  if (canvas.width !== displayW * dpr || canvas.height !== displayH * dpr) {
    canvas.width = displayW * dpr;
    canvas.height = displayH * dpr;
  }

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!videoEl.videoWidth) return;

  // Scale from video-space coords (face-api output) to physical canvas pixels
  const scaleX = canvas.width / videoEl.videoWidth;
  const scaleY = canvas.height / videoEl.videoHeight;

  ctx.save();
  ctx.scale(scaleX, scaleY);

  for (const face of LocalState.activeFaces) {
    const { x, y, w, h } = face.bbox;
    const person = LocalState.knowledgeGraph.people[face.id];

    // Card to the right of the face, vertically centered on it
    const cardW = 200;
    const cardH = person?.topics?.length > 0 ? 72 : 52;
    const cardGap = 10;
    const cardX = Math.min(x + w + cardGap, videoEl.videoWidth - cardW - 4);
    const cardY = Math.max(0, Math.min(y + h / 2 - cardH / 2, videoEl.videoHeight - cardH - 4));

    ctx.fillStyle = "rgba(10, 10, 10, 0.82)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 8);
    ctx.fill();

    // Accent bar on the left edge of the card
    ctx.fillStyle = face.matched ? "#6ee7b7" : "#FF6B6B";
    roundRect(ctx, cardX, cardY, 3, cardH, 2);
    ctx.fill();

    // Name
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 13px Inter, system-ui, sans-serif";
    ctx.fillText(
      person?.display_name || (face.matched ? face.id : "Unknown"),
      cardX + 12,
      cardY + 20
    );

    // Topics
    if (person?.topics?.length > 0) {
      ctx.fillStyle = "#9CA3AF";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.fillText(person.topics.slice(0, 2).join(" · "), cardX + 12, cardY + 38);
    }

    // Last seen
    if (person?.last_seen) {
      ctx.fillStyle = "#6B7280";
      ctx.font = "10px Inter, system-ui, sans-serif";
      const row = person?.topics?.length > 0 ? cardY + 56 : cardY + 38;
      ctx.fillText("Last seen " + formatTime(person.last_seen), cardX + 12, row);
    }
  }

  ctx.restore();
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
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
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
