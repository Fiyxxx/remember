#!/usr/bin/env bash
set -e

# Start backend (activate venv first)
echo "[start] Starting backend on :8000..."
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend static server
echo "[start] Starting frontend on :3000..."
npx serve frontend &
FRONTEND_PID=$!

echo "[start] Both services running."
echo "[start]   Frontend: http://localhost:3000"
echo "[start]   Backend:  http://localhost:8000"
echo "[start] Ctrl+C to stop."

cleanup() {
  echo "[start] Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup INT TERM
wait
