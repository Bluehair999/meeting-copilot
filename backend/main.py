import os
import json
import tempfile
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio
import re
from openai import AsyncOpenAI
from dotenv import load_dotenv

import sqlite3

load_dotenv()

# Database Setup
DB_PATH = os.path.join(os.path.dirname(__file__), "glossary.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS glossary (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            category TEXT,
            language_tab TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

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
    last_transcript = "" # 3조 역할 (이전 문맥 기억용)
    glossary = [] # [{source, target}]
    
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
                if "glossary" in init_data:
                    glossary = init_data["glossary"]
            except Exception:
                pass
                
        while True:
            message = await websocket.receive()
            if "text" in message:
                try:
                    data = json.loads(message["text"])
                    if data.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                        continue
                except:
                    pass

            if "bytes" in message:
                audio_data = message["bytes"]
                if len(audio_data) < 1000:
                    continue
                    
                with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp:
                    tmp.write(audio_data)
                    tmp_path = tmp.name
                
                try:
                    # Use provided key only
                    api_key = ws_api_key
                    if not api_key:
                        await websocket.send_json({"text": "[API Key Required] 화면 상단의 API Key 입력창에 실제 OPENAI_API_KEY를 입력하고 Confirm을 눌러주세요."})
                        continue
                        
                    current_client = AsyncOpenAI(api_key=api_key)
                    
                    if input_lang == "ko":
                        prompt_hint = "다음은 건설 인프라 프로젝트를 위한 비즈니스 회의입니다. 자연스럽게 말씀해주세요."
                    elif input_lang == "en":
                        prompt_hint = "This is a business meeting for a civil infrastructure project."
                    elif input_lang == "pl":
                        prompt_hint = "To jest spotkanie biznesowe dotyczące projektu infrastrukturalnego."
                    else:
                        prompt_hint = "Meeting transcription."
                        
                    if custom_vocab:
                        prompt_hint += f" 전문 용어 힌트: {custom_vocab}"
                        
                    # 3조 역할: 앞선 문맥 전달 (Overlapping 중복 방지 및 맥락 유지)
                    if last_transcript:
                        prompt_hint += f" (이전 문장: {last_transcript})"
                    
                    # 언어 자동 감지 모드인 경우 language=None으로 설정
                    stt_lang = None if input_lang == "auto" else input_lang
                        
                    with open(tmp_path, "rb") as audio_file:
                        transcript = await current_client.audio.transcriptions.create(
                            model="whisper-1", 
                            file=audio_file,
                            language=stt_lang,
                            prompt=prompt_hint,
                            temperature=0.0,
                            response_format="verbose_json"
                        )
                    
                    original_text = transcript.text.strip()
                    detected_lang_code = getattr(transcript, "language", input_lang)
                    
                    # 이모티콘 제거 정규식 (유니코드 Supplementary Planes를 대부분 날림)
                    original_text = re.sub(r'[\U00010000-\U0010ffff]', '', original_text)
                    
                    # 명백한 환각 직접 제거
                    original_text = original_text.replace("구독과 좋아요 부탁드립니다", "")
                    original_text = original_text.replace("구독과 좋아요", "")
                    original_text = original_text.replace("구독, 좋아요, 알림설정 부탁드립니다", "")
                    original_text = original_text.replace("구독, 좋아요, 알림 설정 부탁드립니다", "")
                    original_text = original_text.replace("시청해주셔서 감사합니다", "")
                    original_text = original_text.strip()
                    
                    # Whisper Hallucination Filter (무음 또는 백색 소음 시 발생하는 흔한 오류 문구 제거)
                    hw_filter = original_text.replace(" ", "").replace(".", "").replace(",", "").replace("!", "").replace("?", "")
                    hallucinations = [
                        "시청해주셔서감사합니다", 
                        "구독과좋아요부탁드립니다",
                        "구독과좋아요",
                        "구독좋아요",
                        "알림설정부탁드립니다",
                        "구독좋아요알림설정부탁드립니다",
                        "구독좋아요알림설정",
                        "시청해주셔서고맙습니다",
                        "관심가져주셔서감사합니다",
                        "자막제작"
                    ]
                    if any(h in hw_filter for h in hallucinations) and len(original_text) < 40:
                        continue
                        
                    # Prompt Echo Hallucination Filter (입력된 프롬프트를 앵무새처럼 반복하는 증상)
                    if original_text.count("PSC박스") > 2 or original_text.count("프리스트레스트") > 2 or original_text.count("도화엔지니어링") > 2:
                        continue
                        
                    if not original_text:
                        continue
                        
                    # 다음 청크를 위해 마지막 50글자만 맥락으로 저장
                    last_transcript = original_text[-50:] if len(original_text) > 50 else original_text
                    
                    # 상호 통역(Auto-Interpreter) 로직
                    current_target_lang = translate_lang
                    if input_lang == "auto":
                        # 감지된 언어에 따라 번역 방향 결정 (기본: ko <-> pl)
                        if detected_lang_code == "korean" or detected_lang_code == "ko":
                            current_target_lang = "pl"
                        elif detected_lang_code == "polish" or detected_lang_code == "pl":
                            current_target_lang = "ko"
                        else:
                            # 그 외 언어는 기존 설정된 translate_lang 유지 또는 기본값
                            current_target_lang = translate_lang if translate_lang != "none" else "en"

                    if current_target_lang == "none":
                        # 번역 없이 원문만 송신
                        await websocket.send_json({
                            "original": original_text,
                            "source_lang": detected_lang_code
                        })
                    else:
                        # Glossary 및 AI 번역 수행
                        glossary_prompt = ""
                        if glossary:
                            terms = "\n".join([f"- {g.get('source')}: {g.get('target')}" for g in glossary])
                            glossary_prompt = f"\n[Glossary / Terminology]\nUse these specific translations if they appear in the source:\n{terms}\n"

                        system_prompt = f"""You are a strict and highly accurate translator.
The original text is strictly in the '{detected_lang_code}' language.
You must translate this text directly into the '{current_target_lang}' language.
{glossary_prompt}
Output ONLY the final translated text in '{current_target_lang}'.
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
                            "translated": translated_text,
                            "source_lang": detected_lang_code,
                            "target_lang": current_target_lang
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
    template_type: Optional[str] = "general"

class ExtractTermsRequest(BaseModel):
    script: str
    target_lang: str # e.g. "Polish", "English", "Spanish"
    api_key: Optional[str] = None

class GlossaryTerm(BaseModel):
    id: str
    source: str
    target: str
    category: Optional[str] = "General"
    language_tab: str

class GlossarySyncRequest(BaseModel):
    terms: list[GlossaryTerm]

@app.post("/api/analyze")
async def analyze_script(req: AnalyzeRequest):
    api_key = req.api_key
    if not api_key:
        return {"result": "[API Key Required] 화면 상단의 API Key 입력창에 올바른 OPENAI_API_KEY를 입력하고 Confirm을 눌러주세요."}
        
    current_client = AsyncOpenAI(api_key=api_key)
    system_prompt = "You are a specialized AI Civil Engineering Meeting Consultant. You accurately analyze technical infrastructure meeting transcripts and provide structured, detailed reports with engineering precision in markdown format."
    
    if req.is_summary:
        if req.participants:
            participants_str = ", ".join(req.participants)
        else:
            participants_str = "참석자 언급 없음"
            
        time_str = req.recording_time if req.recording_time else "시간 언급 없음"

        if req.template_type == "kickoff_trc":
            user_prompt = f"""다음 원본 회의록(스크립트)을 바탕으로 아래 [작성 지침]과 [출력 형식]을 엄격하게 준수하여 'SGR Meeting Minutes' 공식 리포트를 작성하세요.

[작성 지침]
1. 작성 언어: 모든 내용과 항목 제목은 **영어(English)**로 작성할 것 (발언이 한국어라도 전문적인 비즈니스 영어로 완벽히 번역해서 요약).
2. 역할: 당신은 DOHWA-JV 및 TRC 측의 수석 엔지니어(Senior Resident Engineer)를 보좌하는 공식 회의록 작성자(Document Controller)입니다.
3. मै핑(Mapping): 제공된 원문을 철저히 분석하여, 아래 [Agenda Items 1~20] 중 관련이 있는 항목의 세부 내용으로 요약 및 배치하세요. 관련 없는 항목은 억지로 채우지 말고 비워두거나 "No specific discussion." 이라 기재하세요.
4. **Action Items (핵심)**: 대화 내용 중 누군가가 해야 할 '업무 지시, 결정된 향후 작업, 조치 사항'이 나오면 해당 Agenda 항목 내에 다음과 같은 형식으로 반드시 기록하세요.
   * **Action Item [N]:** [해당 업무 내용]
   * **Responsibility:** [책임자/담당자]
   * **Timeline:** [기한/일정]
5. **18. Summary of Action Items**: 위에서 도출된 모든 Action Item을 문서 하단 18번 항목에 마크다운 표(Table) 형식으로 깔끔하게 모아서 요약하세요.
6. 전문 용어: ESHS, C-ESMP, WBS, DAAB 등 토목/건축 FIDIC 계약 양식에 맞는 전문 용어를 살려서 작성하세요.

[출력 양식 구조] (이 마크다운 포맷과 번호를 그대로 복사하여 사용할 것. 빈칸은 원문에서 확인된 경우에만 채우고, 확인되지 않은 정보는 "To be determined" 또는 "No specific discussion"으로 작성할 것. **절대 TB-SGR-KOM-26-01과 같은 예시 데이터를 마음대로 채우지 마십시오.**)

# MINUTES OF SGR MEETING

| Project Information | Details |
|---|---|
| **Document No.** | (원문에서 확인 안될 시: TB-SGR-KOM-26-XX) |
| **Date / Time** | {time_str} |
| **Venue** | (원문에서 확인 안될 시: TBD) |
| **Employer** | Tanzania Railways Corporation (TRC) |
| **Engineer** | DOHWA Engineering Co., Ltd JV |
| **Contractor** | CREGC-CREDC Consortium |

---

## 1. Opening and Introduction
- 

## 2. Project Overview
- 

## 3. Roles and Responsibilities (Sub-Clause 3.1, 3.5, 4.1)
- 

## 4. Commencement Readiness and Mobilization (Sub-Clause 4.3, 6.9, 8.1)
- 

## 5. Employer's and Engineer's Facilities (Sub-Clause 4.23)
- 

## 6. Insurance Arrangements (Clause 18 and 19)
- 

## 7. Programme Submission and Methodology (Sub-Clause 8.3)
- 

## 8. Design Management and Design Review Procedure (Sub-Clause 5.2)
- 

## 9. Quality Management System (Sub-Clause 4.9)
- 

## 10. ESHS - Environment, Social, Health and Safety (Sub-Clause 4.8, 6.7)
- 

## 11. Initial Deliverables and Reporting (Sub-Clause 4.21)
- 

## 12. Communication and Document Control (Sub-Clause 1.3)
- 

## 13. Meeting Arrangements
- 

## 14. Constitution of DAAB (Sub-Clause 21.1, 21.2)
- 

## 15. Contractor's Presentation - Site Establishment and Mobilization Plans
- 

## 16. Any Other Business (AOB)
- 

## 17. Concluding Statement
- 

---

## 18. Summary of Action Items
| No. | Action Item | Responsibility | Timeline |
|---|---|---|---|
| 1 | (Action Item 내용) | (책임자) | (기한) |
| 2 | ... | ... | ... |

## 19. Next Meeting
- **Date/Time:** 
- **Venue:** 
- **Participants:** 

## 20. Meeting Closure
- (종료 시간 및 내용)

---
[Original Transcript for Analysis]
{req.script}
"""
        else:
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
        # Full Report (원문 스크리닝 및 화자 구분)
        participants_hint = f"참석자 명단: {', '.join(req.participants)}" if req.participants else "참석자 명단이 제공되지 않았습니다. 문맥을 통해 화자를 추측하거나 '화자 1, 2' 등으로 표기하세요."
        
        user_prompt = f"""다음은 회의 중 녹음된 원본 음성 인식(STT) 스크립트입니다.
당신의 역할은 두 가지입니다:
1. **스크리닝**: 음성 인식 오류로 발생한 명백한 환각(Hallucinations)이나 잡음, 무의미한 문장을 제거하되, 대화 내용은 100% 보존하세요.
2. **화자 구분**: 대화 문맥과 아래 제공된 참석자 명단을 바탕으로, 각 발언의 화자를 판단하여 [이름] 또는 [화자 N] 형식으로 문장 앞에 붙여주세요.

{participants_hint}

[지침]
- 화자의 대화 내용이나 어투는 절대 수정하거나 요약하지 마세요. (원본 보존 원칙)
- 각 발언이 바뀔 때마다 줄바꿈을 하고 화자 이름을 표시하세요.
- 결과물은 스크리닝과 화자 구분이 완료된 텍스트만 출력하세요. (추가 설명 금지)

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
            # GPT-4 sometimes wraps the output in ``` or ```markdown, strip those out
            if screened_script.startswith("```"):
                screened_script = re.sub(r"^```[a-zA-Z]*\n?", "", screened_script)
                if screened_script.endswith("```"):
                    screened_script = screened_script[:-3].strip()

            result = f"## 🎙️ 전체 회의 스크립트 (AI 화자 구분 및 스크리닝 완료)\n\n{screened_script}"
        except Exception as e:
            result = f"[Analysis Error] GPT 스크리닝 중 오류가 발생했습니다: {str(e)}\n\n## 🎙️ 100% 원본 스크립트\n\n{req.script}"
        
    return {"result": result}

@app.post("/api/extract-terms")
async def extract_terms(req: ExtractTermsRequest):
    api_key = req.api_key
    if not api_key:
        return {"terms": [], "error": "API Key Required"}
        
    if not req.script or len(req.script.strip()) < 10:
        return {"terms": [], "error": "대화 내용이 너무 짧거나 없습니다."}

    current_client = AsyncOpenAI(api_key=api_key)
    
    system_prompt = f"""You are a Terminology Extraction Expert. 
Your task is to analyze the provided meeting transcript and extract key technical terms, project-specific jargon, or unique proper nouns.
For each term, provide a translation between Korean and {req.target_lang}.

Return ONLY a JSON array of objects with the following structure:
[
  {{ "source": "Korean Word", "target": "{req.target_lang} Translation", "category": "Category (e.g. Infrastructure, Legal, Safety)" }},
  ...
]
Do NOT include any explanations or markdown formatting (like ```json), just the raw JSON array string."""

    try:
        completion = await current_client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"Transcript to analyze:\n{req.script}"}
            ],
            response_format={ "type": "json_object" } if False else None # Some envs don't support response_format yet, so we'll just parse the content
        )
        content = completion.choices[0].message.content.strip()
        
        # Clean up possible markdown wraps
        if content.startswith("```"):
            content = re.sub(r"^```[a-zA-Z]*\n?", "", content)
            if content.endswith("```"):
                content = content[:-3].strip()
        
        terms = json.loads(content)
        # If it returned a dict with a key like "terms", extract it. Otherwise expect a list.
        if isinstance(terms, dict):
            for key in ["terms", "terminology", "data"]:
                if key in terms:
                    terms = terms[key]
                    break
        
        if not isinstance(terms, list):
            return {"terms": [], "error": "AI가 리스트 형식을 반환하지 않았습니다."}
            
        return {"terms": terms}
    except Exception as e:
        return {"terms": [], "error": str(e)}

@app.get("/api/glossary")
def get_glossary():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM glossary")
    rows = cursor.fetchall()
    conn.close()
    
    result = {}
    for row in rows:
        tab = row["language_tab"]
        if tab not in result:
            result[tab] = []
        result[tab].append({
            "id": row["id"],
            "source": row["source"],
            "target": row["target"],
            "category": row["category"]
        })
    return result

@app.post("/api/glossary")
def sync_glossary(req: GlossarySyncRequest):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        for term in req.terms:
            cursor.execute("""
                INSERT OR REPLACE INTO glossary (id, source, target, category, language_tab)
                VALUES (?, ?, ?, ?, ?)
            """, (term.id, term.source, term.target, term.category, term.language_tab))
        conn.commit()
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()
    return {"status": "success"}

@app.delete("/api/glossary/{term_id}")
def delete_term(term_id: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM glossary WHERE id = ?", (term_id,))
        conn.commit()
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()
    return {"status": "success"}

@app.post("/api/glossary/delete-batch")
def delete_batch_terms(req: dict):
    term_ids = req.get("ids", [])
    if not term_ids:
        return {"status": "success"}
        
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    try:
        placeholders = ', '.join(['?'] * len(term_ids))
        query = f"DELETE FROM glossary WHERE id IN ({placeholders})"
        cursor.execute(query, tuple(term_ids))
        conn.commit()
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()
    return {"status": "success"}

