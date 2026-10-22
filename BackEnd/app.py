import os
import json
import time
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()  # .env file se GEMINI_API_KEY parhta hai

app = Flask(__name__)
CORS(app)

API_KEY = os.getenv("GEMINI_API_KEY")

# Pehla model na chale to agla try hota hai
MODELS = ["gemini-3.8-flash", "gemini-3.1-flash-lite-preview", "gemini-2.5-flash-lite"]

PROMPT = """You are a strict, fair senior engineer verifying a developer's skills from code.
Judge ONLY what is visible in the code. Never invent features.
Return ONLY JSON in this shape:
{"score": 0-100,
 "summary": "2 short sentences",
 "skills": [{"name": "Logic|Documentation|Refactoring|Testing|Error handling|Security",
             "score": 0-100,
             "evidence": "one short sentence pointing to something specific in the code"}],
 "badges": [{"name": "2-3 words", "reason": "short reason"}],
 "quality_by_section": [4 to 6 numbers between 0 and 100],
 "complexity": [{"label": "function or file name", "value": 0-100}]}
Give 4 to 6 skills, 0 to 4 badges (only if truly earned), 3 to 6 complexity items.

Developer: %s

CODE:
%s
"""


def call_gemini(body):
    last = None
    for model in MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
        for attempt in range(3):
            r = requests.post(
                url,
                headers={"x-goog-api-key": API_KEY, "Content-Type": "application/json"},
                json=body,
                timeout=60,
            )
            if r.status_code == 200:
                return r
            print(f"Gemini {model} attempt {attempt + 1}: {r.status_code}")
            last = r
            if r.status_code in (429, 503):  # rush ya limit: thora ruk kar dobara
                time.sleep(2 * (attempt + 1))
                continue
            break  # 404 wagera: agle model par jao
    return last


@app.route("/")
def home():
    return jsonify({"message": "DevProof backend is running!"})


@app.route("/api/verify", methods=["POST"])
def verify():
    data = request.get_json() or {}
    code = data.get("code", "")
    name = data.get("name", "unknown")

    if len(code.strip()) < 60:
        return jsonify({"error": "Send at least a few lines of code."}), 400
    if not API_KEY:
        return jsonify({"error": "GEMINI_API_KEY is missing in the .env file."}), 500

    body = {
        "contents": [{"parts": [{"text": PROMPT % (name[:40], code[:12000])}]}],
        "generationConfig": {"responseMimeType": "application/json"},
    }

    try:
        r = call_gemini(body)
        if r.status_code != 200:
            print("Gemini error:", r.status_code, r.text[:300])
            return jsonify({"error": f"AI request failed ({r.status_code}). Please try again in a minute."}), 502

        text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        return jsonify(json.loads(text))
    except Exception as e:
        print("Error:", e)
        return jsonify({"error": "Could not read the AI answer. Please try again."}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)