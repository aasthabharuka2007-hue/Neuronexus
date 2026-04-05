from fastapi import FastAPI, HTTPException, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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

# Initialize captioner globally
captioner = None
captioner_lock = threading.Lock()

def get_captioner():
    global captioner
    with captioner_lock:
        if captioner is None:
            print("Loading Semantic Vision Model into memory...")
            captioner = pipeline("image-to-text", model="nlpconnect/vit-gpt2-image-captioning")
        return captioner

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Keys - fallback to env vars or provide placeholders
NEWS_API_KEY = os.getenv("NEWS_API_KEY", "YOUR_NEWSAPI_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "YOUR_OPENAI_API_KEY")

class SummaryRequest(BaseModel):
    text: str
    lang: str = "en"

class VoiceRequest(BaseModel):
    text: str
    lang: str = "en"

# Create an audio directory if it doesn't exist
os.makedirs("audio", exist_ok=True)

# Mount the audio directory to serve the generated MP3 files
app.mount("/audio", StaticFiles(directory="audio"), name="audio")

MOCK_NEWS = [
    {
        "title": "Quantum Computing Breakthrough: Error Rates Reach All-Time Low",
        "description": "Researchers have published a new method for stabilizing qubits that dramatically reduces the error rate in quantum calculations, paving the way for commercially viable quantum computers within the decade. This discovery could revolutionize cryptography and complex system simulations.",
        "url": "#",
        "image": "https://placehold.co/600x400/2c3e50/ffffff?text=Quantum+Computing",
        "video": ""
    },
    {
        "title": "Exploration Reaches New Heights as Lunar Base Construction Begins",
        "description": "Astronauts and robotics have begun laying the groundwork for the first permanent human settlement on the Moon's south pole. The initial phase includes landing habitat modules and setting up solar panels for sustainable energy.",
        "url": "#",
        "image": "https://placehold.co/600x400/2c3e50/ffffff?text=Lunar+Base",
        "video": ""
    },
    {
        "title": "Global Ocean Cleanup Effort Removes 10 Million Pounds of Plastic",
        "description": "An international coalition utilizing autonomous, solar-powered collection vessels has successfully intercepted and removed a massive amount of plastic waste from the Great Pacific Garbage Patch this year alone, exceeding all projections.",
        "url": "#",
        "image": "https://placehold.co/600x400/2c3e50/ffffff?text=Ocean+Cleanup",
        "video": ""
    }
]

def translate_articles(articles, lang):
    if lang == "en":
        return articles
    
    translated_articles = []
    translator = GoogleTranslator(source='auto', target=lang)
    for article in articles:
        new_art = article.copy()
        if article.get("title"):
            try:
                new_art["title"] = translator.translate(article["title"])
            except: pass
        if article.get("description"):
            try:
                new_art["description"] = translator.translate(article["description"])
            except: pass
        translated_articles.append(new_art)
    return translated_articles

@app.get("/news")
def get_latest_news(lang: str = "en", mood: str = ""):
    final_list = []
    
    # Priority 1: User's API Key
    if NEWS_API_KEY and NEWS_API_KEY != "YOUR_NEWSAPI_KEY":
        try:
            if mood:
                url = f"https://newsapi.org/v2/everything?q={mood}&sortBy=relevancy&language=en&apiKey={NEWS_API_KEY}"
            else:
                url = f"https://newsapi.org/v2/top-headlines?country=us&apiKey={NEWS_API_KEY}"
                
            response = requests.get(url, timeout=5)
            
            if response.status_code == 200:
                data = response.json()
                articles = data.get("articles", [])
                
                for article in articles:
                    if not article.get("title") or not article.get("description"):
                        continue 
                    
                    final_list.append({
                        "title": article.get("title"),
                        "description": article.get("description"),
                        "url": article.get("url"),
                        "image": article.get("urlToImage"),
                        "video": article.get("url")
                    })
        except:
            pass

    # Priority 2: Public Live News (RSS)
    if not final_list:
        try:
            if mood:
                url = f"https://news.google.com/rss/search?q={mood}+news&hl=en-US&gl=US&ceid=US:en"
            else:
                url = "http://feeds.bbci.co.uk/news/rss.xml"
                
            resp = requests.get(url, timeout=5)
            root = ET.fromstring(resp.content)
            
            for item in root.findall('./channel/item')[:15]:
                title = item.find('title').text
                desc = item.find('description').text
                # Cleanup google news html tags somewhat if we can, else just leave it.
                if mood and "<" in desc:
                    desc_body = desc.split("<")[0] or title 
                    desc = desc_body

                link = item.find('link').text
                
                final_list.append({
                    "title": title,
                    "description": desc,
                    "url": link,
                    "image": f"https://placehold.co/600x400/2c3e50/ffffff?text={mood.capitalize() if mood else 'Live+BBC'}+News",
                    "video": ""
                })
        except:
            pass

    # Priority 3: Fallback Mock News
    if not final_list:
        if mood:
            # Generate a rapid fake list purely for UI demonstration
            final_list = [{"title": f"A uniquely {mood} story discovered recently.", "description": f"Exploring exactly why things feel so {mood} today.", "url": "#", "image": f"https://placehold.co/600x400/2c3e50/ffffff?text={mood.capitalize()}+News", "video": ""}]
        else:
            final_list = MOCK_NEWS

    # Return translated final list
    return translate_articles(final_list, lang)

@app.post("/summary")
def summarize_news(req: SummaryRequest):
    try:
        lang_mapping = {"en": "English", "hi": "Hindi", "mr": "Marathi", "ja": "Japanese"}
        target_language = lang_mapping.get(req.lang, "English")
            
        if OPENAI_API_KEY and OPENAI_API_KEY != "YOUR_OPENAI_API_KEY":
            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": f"You are a helpful assistant. Summarize this news in 2-3 short sentences. Be extremely concise. Translate the summary and respond exclusively in {target_language}."},
                    {"role": "user", "content": req.text}
                ],
                max_tokens=100
            )
            summary = response.choices[0].message.content.strip()
            return {"summary": summary}
        else:
            # Fallback if no OpenAI API key is set
            # Use actual article text so every audio is unique. 
            clean_text = req.text[:200].replace('\n', ' ')
            dummy_text = f"Summary: {clean_text}"
            if len(req.text) > 200:
                dummy_text += "..."

            if req.lang != "en":
                try: 
                    dummy_text = GoogleTranslator(source='auto', target=req.lang).translate(dummy_text)
                except: pass
            return {"summary": dummy_text}
    except Exception as e:
        err_msg = "Failed to connect to OpenAI. Please verify your OPENAI_API_KEY and account balance."
        if req.lang != "en":
             try: err_msg = GoogleTranslator(source='auto', target=req.lang).translate(err_msg)
             except: pass
        return {"summary": err_msg}

@app.post("/voice")
def text_to_speech(req: VoiceRequest):
    try:
        # Generate a unique filename for simultaneous usage without clashing
        filename = f"{uuid.uuid4().hex}.mp3"
        filepath = os.path.join("audio", filename)
        
        # Validate gTTS lang support. Default to en if something goes wrong
        final_lang = req.lang if req.lang in ['en', 'hi', 'mr', 'ja'] else 'en'
        
        tts = gTTS(text=req.text, lang=final_lang)
        tts.save(filepath)
        
        return {"audioPath": f"/audio/{filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def encode_image_base64(file_path):
    with open(file_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

@app.post("/analyze")
async def analyze_media(file: UploadFile = File(...), lang: str = Form("en")):
    tmp_file_path = None
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_file_path = tmp_file.name

        mime_type = file.content_type
        is_video = "video" in mime_type
        
        captions = []
        if is_video:
            cap = cv2.VideoCapture(tmp_file_path)
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if total_frames > 0:
                # Capture middle frame
                cap.set(cv2.CAP_PROP_POS_FRAMES, total_frames // 2)
                ret, frame = cap.read()
                if ret:
                    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    pil_img = Image.fromarray(frame_rgb)
                    try:
                        captn_algo = get_captioner()
                        result = captn_algo(pil_img)
                        captions.append(result[0]['generated_text'])
                    except Exception as cx:
                        print("ML error", cx)
            cap.release()
        else:
            try:
                pil_img = Image.open(tmp_file_path)
                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")
                captn_algo = get_captioner()
                result = captn_algo(pil_img)
                captions.append(result[0]['generated_text'])
            except Exception as e:
                print("ML error", e)

        if tmp_file_path and os.path.exists(tmp_file_path):
            try: os.unlink(tmp_file_path)
            except: pass

        basename = os.path.splitext(file.filename)[0].replace('-', ' ').replace('_', ' ').capitalize()
        
        info_string = ""
        if captions:
            ai_caption = captions[0]
            if is_video:
                info_string = f"Deep Video Analysis: A central snapshot from this sequence shows {ai_caption}. This video is named '{basename}'."
            else:
                info_string = f"Deep Image Analysis: The photo clearly depicts {ai_caption}. This file is locally named '{basename}'."
        else:
            if is_video:
                info_string = f"Media Analysis: This is a video file named '{basename}'. I was unable to pull a clean semantic frame out of the stream."
            else:
                info_string = f"Media Analysis: This is an image file named '{basename}'. The machine learning visual pathway failed to lock onto the pixel shapes."

        if lang != "en":
            try: info_string = GoogleTranslator(source='auto', target=lang).translate(info_string)
            except: pass
            
        return {"analysis": info_string}
            

    except Exception as e:
        if tmp_file_path and os.path.exists(tmp_file_path):
            try: os.unlink(tmp_file_path)
            except: pass
        return {"analysis": f"Error analyzing media: {str(e)}"}

# Mount static files at the root level LAST, so it doesn't intercept API routes
app.mount("/", StaticFiles(directory=".", html=True), name="static")
