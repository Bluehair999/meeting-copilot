import os
import json
import tempfile
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv

load_dotenv()

client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", "dummy_key"))

app = FastAPI(title="Meeting Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Welcome to Meeting Copilot API"}

# WebSocket for STT (Real Audio Chunking)
@app.websocket("/ws/record")
async def websocket_record(websocket: WebSocket):
    await websocket.accept()
    input_lang = "ko"
    translate_lang = "none"
    custom_vocab = ""
    
    try:
        ws_api_key = None
        init_message = await websocket.receive()
        if "text" in init_message:
            try:
                init_data = json.loads(init_message["text"])
                if "inputLang" in init_data:
                    input_lang = init_data["inputLang"]
                if "translateLang" in init_data:
                    translate_lang = init_data["translateLang"]
                if "apiKey" in init_data and init_data["apiKey"].strip():
                    ws_api_key = init_data["apiKey"].strip()
                if "customVocab" in init_data and init_data["customVocab"].strip():
                    custom_vocab = init_data["customVocab"].strip()
            except Exception:
                pass
                
        while True:
            message = await websocket.receive()
            if "bytes" in message:
                audio_data = message["bytes"]
                if len(audio_data) < 1000:
                    continue
                    
                with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                    tmp.write(audio_data)
                    tmp_path = tmp.name
                
                try:
                    api_key = ws_api_key or os.getenv("OPENAI_API_KEY", "dummy_key")
                    if not api_key or api_key in ["dummy_key", "your_api_key_here"]:
                        await websocket.send_json({"text": "[System API Key Required] 화면 상단의 API Key 입력창에 실제 OPENAI_API_KEY를 입력해주세요."})
                        continue
                        
                    current_client = AsyncOpenAI(api_key=api_key)
                    
                    if input_lang == "ko":
                        prompt_hint = "진지한 비즈니스 회의입니다. 들리는 그대로 정확히 한국어로만 작성하세요. 이모티콘(Emoji)이나 '구독과 좋아요' 같은 문구는 절대 추가하지 마세요."
                    elif input_lang == "en":
                        prompt_hint = "This is an English meeting recording. Transcribe exactly what you hear in English only."
                    elif input_lang == "pl":
                        prompt_hint = "To jest nagranie ze spotkania w języku polskim. Dokładnie zrób transkrypcję tylko po polsku."
                    else:
                        prompt_hint = "Transcribe exactly what is spoken."
                        
                    if custom_vocab:
                        prompt_hint += f" 자주 쓰이는 핵심 고유명사/전문용어: {custom_vocab}"
                        
                    with open(tmp_path, "rb") as audio_file:
                        transcript = await current_client.audio.transcriptions.create(
                            model="whisper-1", 
                            file=audio_file,
                            language=input_lang,
                            prompt=prompt_hint
                        )
                    
                    original_text = transcript.text.strip()
                    
                    # 이모티콘 제거 정규식 (유니코드 Supplementary Planes를 대부분 날림)
                    original_text = re.sub(r'[\U00010000-\U0010ffff]', '', original_text)
                    
                    # 명백한 환각 직접 제거
                    original_text = original_text.replace("구독과 좋아요 부탁드립니다", "")
                    original_text = original_text.replace("구독과 좋아요", "")
                    original_text = original_text.replace("시청해주셔서 감사합니다", "")
                    original_text = original_text.strip()
                    
                    # Whisper Hallucination Filter (무음 또는 백색 소음 시 발생하는 흔한 오류 문구 제거)
                    hw_filter = original_text.replace(" ", "").replace(".", "").replace(",", "").replace("!", "").replace("?", "")
                    hallucinations = [
                        "시청해주셔서감사합니다", 
                        "구독과좋아요부탁드립니다",
                        "구독과좋아요",
                        "시청해주셔서고맙습니다",
                        "자막제작"
                    ]
                    if any(h in hw_filter for h in hallucinations) and len(original_text) < 30:
                        continue
                        
                    if not original_text:
                        continue
                        
                    if translate_lang == "none":
                        await websocket.send_json({"text": original_text})
                    else:
                        system_prompt = f"""You are a strict and highly accurate translator.
The original text is strictly in the '{input_lang}' language.
You must translate this text directly into the '{translate_lang}' language.
Output ONLY the final translated text in '{translate_lang}'.
Do NOT output the original language, and do NOT add any conversational fillers or explanations.
"""

                        completion = await current_client.chat.completions.create(
                            model="gpt-4o-mini",
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": original_text}
                            ]
                        )
                        translated_text = completion.choices[0].message.content.strip()
                        await websocket.send_json({
                            "original": original_text,
                            "translated": translated_text
                        })
                        
                except Exception as e:
                    await websocket.send_json({"text": f"[API 연동 에러] {str(e)}"})
                finally:
                    if os.path.exists(tmp_path):
                        os.remove(tmp_path)
    except WebSocketDisconnect:
        print("Client disconnected from /ws/record")
    except Exception as e:
        print(f"WS Error: {e}")

from pydantic import BaseModel

from typing import Optional

class AnalyzeRequest(BaseModel):
    script: str
    is_summary: bool
    api_key: Optional[str] = None
    participants: Optional[list[str]] = None
    recording_time: Optional[str] = None

@app.post("/api/analyze")
async def analyze_script(req: AnalyzeRequest):
    api_key = req.api_key if req.api_key else os.getenv("OPENAI_API_KEY", "dummy_key")
    if not api_key or api_key in ["dummy_key", "your_api_key_here"]:
        return {"result": "[System API Key Required] 화면 상단의 API Key 입력창에 올바른 OPENAI_API_KEY를 입력해주세요."}
        
    current_client = AsyncOpenAI(api_key=api_key)
    system_prompt = "You are an expert AI meeting assistant. You accurately analyze meeting transcripts and provide structured, detailed reports using markdown format."
    
    if req.is_summary:
        if req.participants:
            participants_str = ", ".join(req.participants)
        else:
            participants_str = "참석자 언급 없음"
            
        time_str = req.recording_time if req.recording_time else "시간 언급 없음"

        user_prompt = f"""다음 원본 회의록을 바탕으로 아래 [작성 지침]과 [출력 형식]을 엄격하게 준수하여 요약 리포트를 작성해주세요.

[작성 지침]
1. 기본 원칙
- 모든 항목은 누락 없이 반드시 작성
- 정보가 없는 경우 임의 작성 금지 → 기준 문구 사용 ("참석자 언급 없음", "장소 언급 없음")
- 서술은 간결·객관적 문장으로 작성
- 불필요한 해석/추정 금지 (회의에서 언급된 내용만 기록)
- 항목 순서 및 형식 절대 변경 금지
- 마크다운 기호(*, # 등)를 사용한 텍스트 강조나 제목 표시를 절대 사용하지 말 것 (오직 대괄호 문자, 숫자, 하이픈(-) 기호만 사용)
- 사용자가 요구하지 않은 별도의 항목(예: '전체 요약', '향후 과제' 등)을 임의로 추가하지 말 것

2. 세부 규칙
(1) 회의 개요
- 회의 주제: 회의 전체를 대표하는 한 줄 요약
- 주요 참석자: {participants_str} (이 내용을 그대로 사용할 것)
- 일시: {time_str} (이 내용을 그대로 사용할 것)
- 장소: 회의 중 명시된 경우만 작성 (없는 경우 "장소 언급 없음")
(2) 주요 안건
- 회의에서 논의된 핵심 항목만 3~7개 수준으로 구조화 (각 항목은 명사형 또는 간결한 문장형)
(3) 세부 논의 내용
- 반드시 위 주요 안건과 동일한 개수 유지
- 각 항목 아래에 핵심 논의 내용, 결정 사항, 필요 시 이슈/조건을 bullet 형태로 작성 (불필요한 문장 금지, 하나의 bullet에는 하나의 내용만 기재)

[출력 형식] (아래 구조와 제목을 그대로 유지할 것)

# [회의 개요]
1. 회의 주제 : 
2. 주요 참석자 : {participants_str}
3. 일시 : {time_str}
4. 장소 : 

# [주요 안건]
1. 
2. 
...

# [세부 논의 내용]
1. (주요안건 1 제목)
   - 
   - 
2. (주요안건 2 제목)
   - 
   - 
...

---
[회의록 원본]
{req.script}
"""
        
        try:
            completion = await current_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            result = completion.choices[0].message.content.strip()
        except Exception as e:
            result = f"[Analysis Error] GPT-4o 분석 중 오류가 발생했습니다: {str(e)}"
    else:
        # Full Report (원문 스크리닝)
        user_prompt = f"""다음은 회의 중 녹음된 원본 음성 인식(STT) 스크립트입니다.
당신의 역할은 이 원본 스크립트의 대화 내용(문맥, 어투, 정보 등)은 100% 그대로 유지하되, 음성 인식 기계의 오류로 발생한 명백한 환각(Hallucinations)이나 전혀 의미 없는 잡음, 혹은 맥락과 전혀 맞지 않는 기계적 치찰음만 살짝 제거하는 가벼운 스크리닝을 수행하는 것입니다.

[지침]
1. 화자의 대화 내용이나 어투, 문장 구조는 절대 무단으로 요약하거나 변경하지 마세요. (원본 내용을 최대한 100% 보존)
2. 명백히 오작동으로 보이는 무의미한 문장(예: "시청해주셔서 감사합니다", 불필요한 단어 무한 반복 등)만 조용히 삭제하세요.
3. 결과물은 스크리닝이 완료된 텍스트만 출력하세요. (인삿말이나 추가 설명 절대 금지)

[회의록 원본]
{req.script}
"""
        try:
            completion = await current_client.chat.completions.create(
                model="gpt-4o",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ]
            )
            screened_script = completion.choices[0].message.content.strip()
            result = f"## 🎙️ 전체 회의 스크립트 (AI 스크리닝 완료)\n\n{screened_script}"
        except Exception as e:
            result = f"[Analysis Error] GPT 스크리닝 중 오류가 발생했습니다: {str(e)}\n\n## 🎙️ 100% 원본 스크립트\n\n{req.script}"
        
    return {"result": result}

