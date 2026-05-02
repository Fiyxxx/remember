/**
 * overlay.js — canvas rendering for face bounding boxes and info cards
 */

export function drawOverlay(canvas) {
  // TODO: Clear canvas, then for each face in LocalState.activeFaces:
  //   - Draw bounding box
  //   - Draw name label
  //   - Draw info card with topics/notes from LocalState.knowledgeGraph
}

export function startRenderLoop(canvas, videoEl) {
  // TODO: Resize canvas to match videoEl dimensions
  // Call drawOverlay(canvas) via requestAnimationFrame loop
}
