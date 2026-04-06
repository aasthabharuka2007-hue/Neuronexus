from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import requests
import openai
from gtts import gTTS
import os
import uuid
from deep_translator import GoogleTranslator
import xml.etree.ElementTree as ET
import cv2
import base64
import tempfile
import shutil
from transformers import pipeline
from PIL import Image
import threading

# -------------------------------
# INIT APP
# -------------------------------
app = FastAPI()

# -------------------------------
# CORS (IMPORTANT for frontend)
# -------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# GLOBALS
# -------------------------------
captioner = None
captioner_lock = threading.Lock()

def get_captioner():
    global captioner
    with captioner_lock:
        if captioner is None:
            print("Loading AI model...")
            captioner = pipeline("image-to-text", model="nlpconnect/vit-gpt2-image-captioning")
        return captioner

NEWS_API_KEY = os.getenv("NEWS_API_KEY", "YOUR_NEWSAPI_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY")

# -------------------------------
# MODELS
# -------------------------------
class SummaryRequest(BaseModel):
    text: str
    lang: str = "en"

class VoiceRequest(BaseModel):
    text: str
    lang: str = "en"

# -------------------------------
# STATIC + AUDIO SETUP
# -------------------------------
os.makedirs("audio", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

# 👇 IMPORTANT: frontend folder
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# -------------------------------
# ROOT ROUTE (MAIN FIX)
# -------------------------------
@app.get("/")
def serve_home():
    return FileResponse("frontend/index.html")

# -------------------------------
# NEWS API
# -------------------------------
@app.get("/news")
def get_latest_news(lang: str = "en", mood: str = ""):
    return {"message": "News API working"}  # keep your full logic here

# -------------------------------
# SUMMARY
# -------------------------------
@app.post("/summary")
def summarize_news(req: SummaryRequest):
    return {"summary": "Working"}  # keep your logic

# -------------------------------
# VOICE
# -------------------------------
@app.post("/voice")
def text_to_speech(req: VoiceRequest):
    try:
        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join("audio", filename)

        tts = gTTS(text=req.text, lang=req.lang)
        tts.save(filepath)

        return {"audioPath": f"/audio/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# -------------------------------
# ANALYZE
# -------------------------------
@app.post("/analyze")
async def analyze_media(file: UploadFile = File(...), lang: str = Form("en")):
    return {"analysis": "AI working"}  # keep your logic

# -------------------------------
# IMPORTANT: REMOVE THIS ❌
# app.mount("/", StaticFiles(directory=".", html=True), name="static")
# -------------------------------
