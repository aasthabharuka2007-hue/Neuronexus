<<<<<<< HEAD
# AI Voice News Reader

Production-style full-stack app: **NewsAPI** headlines, **Google Gemini** (default) or **OpenAI** for summaries / vision / video transcription, **OpenAI TTS** (optional MP3) with browser fallback, **ffmpeg** for video audio extract, and **SQLite** for preferences and history.

## Folder structure

```
Aastha/
├── README.md
├── .gitignore
├── backend/
│   ├── .env                 # create from .env.example (not committed)
│   ├── .env.example
│   ├── requirements.txt
│   └── app/
│       ├── main.py          # FastAPI app, CORS, lifespan
│       ├── config.py
│       ├── database.py
│       ├── dependencies.py
│       ├── models/
│       │   ├── schemas.py   # Pydantic DTOs
│       │   └── db_models.py # SQLAlchemy tables
│       ├── routers/
│       │   ├── news.py
│       │   ├── summarize.py
│       │   ├── tts.py
│       │   ├── media.py     # analyze-image, analyze-video
│       │   ├── preferences.py
│       │   └── history.py
│       ├── services/
│       │   ├── news_service.py
│       │   ├── ai_service.py
│       │   └── cache.py
│       └── utils/
│           ├── logging_config.py
│           └── validators.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.ts       # dev proxy → backend :8000
    └── src/
        ├── api/
        ├── components/
        ├── context/
        ├── hooks/
        ├── pages/
        └── App.tsx
```

## Prerequisites

- **Python 3.11+**
- **Node.js 20+** (for Vite)
- **ffmpeg** on the server host (required for `/analyze-video`)
- API keys: **NewsAPI.org** (required); **Gemini** ([AI Studio](https://aistudio.google.com/app/apikey)) and/or **OpenAI** — see `.env.example`

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env: NEWS_API_KEY, GEMINI_API_KEY (recommended), optional OPENAI_API_KEY for TTS
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

SQLite file defaults to `voice_news.db` in the current working directory (usually `backend/`).

### API summary

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness |
| GET | `/news` | Query: `category`, `country`, `keyword` |
| POST | `/summarize` | JSON: `text`, `language` (`en` \| `hi` \| `mr`); optional header `X-User-Id` |
| POST | `/tts` | JSON: `text`, `language`, `voice`; returns `audio/mpeg` |
| POST | `/analyze-image` | Multipart `file`; header `X-User-Id` |
| POST | `/analyze-video` | Multipart `file`, form `language`; header `X-User-Id`; needs ffmpeg |
| GET/PUT | `/preferences/{user_id}` | Header `X-User-Id` must match path |
| GET | `/history/{user_id}` | Recent activity; header `X-User-Id` |

## Frontend setup

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The dev server proxies API calls to **http://127.0.0.1:8000**.

For production, set `VITE_API_URL` to your API origin and configure `CORS_ORIGINS` on the backend (see `backend/.env.example`).

## Security notes

- Secrets only in `.env` (never commit `.env`).
- Upload size limited by `MAX_UPLOAD_MB` (default 50).
- `X-User-Id` is a lightweight client identifier (UUID in `localStorage`), not full auth.

## License

MIT (adjust as needed for your use case).
=======
# Neuronexus

## About
This project was built using an Antigravity-hosted ML model.

## Status
⚠️ The model endpoint has expired and is no longer active.

## Next Steps
- Rebuild or redeploy the model
- Upload model files or code
- Connect a permanent API
>>>>>>> f873223246b40cd9988f8871ed8790a0f5cb3c1e
