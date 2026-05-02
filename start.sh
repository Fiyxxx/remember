#!/usr/bin/env bash
set -e

# Start backend
echo "[start] Starting backend on :8000..."
cd backend
uvicorn main:app --reload --port 8000 &
BACKEND_PID=$!
cd ..

# Start frontend
echo "[start] Starting frontend on :3000..."
npx serve frontend &
FRONTEND_PID=$!

echo "[start] Both services running. Ctrl+C to stop."

cleanup() {
  echo "[start] Shutting down..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  exit 0
}

trap cleanup INT TERM
wait
