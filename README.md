# Remember

Smart glasses simulator — real-time face recognition, live transcription, and AI-powered knowledge graph in the browser.

## Quick Start

### Frontend
```bash
npx serve frontend
# open http://localhost:3000
```

### Backend
```bash
cd backend
cp .env.example .env        # add your GEMINI_API_KEY
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Both at once
```bash
chmod +x start.sh && ./start.sh
```

## .env Setup

Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY` to your Gemini API key.

## Branch Structure

| Branch | Scope |
|--------|-------|
| `feat/frontend` | `frontend/` — face-api, overlay, speech, state |
| `feat/backend` | `backend/` — FastAPI, Gemini, knowledge graph |
