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

# client instance is now created per-request with the user's API key

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
                        prompt_hint = "도화엔지니어링, 토목, 철도, 설계, 건설, 현장, 회의. 이어서 진행되는 대화 내용:"
                    elif input_lang == "en":
                        prompt_hint = "Civil engineering, infrastructure, professional meeting conversation:"
                    elif input_lang == "pl":
                        prompt_hint = "Inżynieria lądowa, spotkanie biznesowe, infrastruktura:"
                    else:
                        prompt_hint = "Meeting transcription:"
                        
                    # Civil Engineering core terminology as default hint
                    core_civil_vocab = "교량, 교대, 교각, 기초, 말뚝, 현장타설말뚝, PHC말뚝, 강관말뚝, 케이슨, 직접기초, 교좌장치, 신축이음, 슬래브, 상부구조, PSC, PSC박스, 프리스트레스트, 강선, 텐던, 정착구, 강합성거더, BIM, CDE, EIR, LOD, PB, PAB, PT, 설계도서, 계산서, 도화, Dohwa"
                    prompt_hint += f" 자주 쓰이는 핵심 고유명사/전문용어: {core_civil_vocab}"
                    
                    if custom_vocab:
                        prompt_hint += f", {custom_vocab}"
                        
                    # 3조 역할: 앞선 문맥 전달 (Overlapping 중복 방지 및 맥락 유지)
                    if last_transcript:
                        prompt_hint += f", 이전에 이렇게 말했음(말이 이어짐): {last_transcript}"
                        
                    with open(tmp_path, "rb") as audio_file:
                        transcript = await current_client.audio.transcriptions.create(
                            model="whisper-1", 
                            file=audio_file,
                            language=input_lang,
                            prompt=prompt_hint,
                            temperature=0.0
                        )
                    
                    original_text = transcript.text.strip()
                    
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
                        
                    if not original_text:
                        continue
                        
                    # 다음 청크를 위해 마지막 50글자만 맥락으로 저장
                    last_transcript = original_text[-50:] if len(original_text) > 50 else original_text
                        
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
    template_type: Optional[str] = "general"

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
            user_prompt = f"""다음 원본 회의록(스크립트)을 바탕으로 아래 [작성 지침]과 [출력 형식]을 엄격하게 준수하여 'Kick-off Meeting Minutes' 공식 리포트를 작성하세요.

[작성 지침]
1. 작성 언어: 모든 텍스트는 **영어(English)**로 작성할 것 (한국어 발언도 영어로 정확히 번역해서 요약할 것).
2. 역할: 당신은 DOHWA-JV 및 TRC 측의 수석 엔지니어(Senior Resident Engineer)를 보좌하는 회의록 기록관입니다.
3. 매핑(Mapping): 제공된 원본 대화를 분석하여, 하단의 17개 [Agenda Items] 중 관련이 있는 항목 아래에 내용을 불릿포인트(Bullet points)로 요약 배치하세요.
4. 원문에 논의되지 않은 목차(Agenda)는 억지로 지어내지 말고, 내용을 비워두거나 "No specific discussion recorded during this session." 이라고 적으세요.
5. 마크다운 문법(*, **, 테이블 등)을 사용해 프로페셔널한 공식 문서처럼 출력하세요.

[출력 양식 구조] (아래의 양식 틀을 그대로 유지하며 빈칸을 채우세요)

# MINUTES OF KICK-OFF MEETING

| Project Information | Details |
|---|---|
| **Document No.** | TB-SGR-KOM-26-01 |
| **Date / Time** | {time_str} |
| **Venue** | Conference Room at TRC Headquarters (or based on transcript) |
| **Employer** | Tanzania Railways Corporation (TRC) |
| **Engineer** | DOHWA Engineering Co., Ltd JV |
| **Contractor** | CREGC-CREDC Consortium |

## MEETING AGENDA DISCUSSIONS

**1. Opening and Introduction**
- (Extract related points here)

**2. Project Overview**
- (Extract related points here)

**3. Roles and Responsibilities (Sub-Clause 3.1, 3.5, 4.1)**
- 

**4. Commencement Readiness and Mobilization (Sub-Clause 4.3, 6.9, 8.1)**
- 

**5. Employer's and Engineer's Facilities (Sub-Clause 4.23)**
- 

**6. Insurance Arrangements (Clause 18 and 19)**
- 

**7. Programme Submission and Methodology (Sub-Clause 8.3)**
- 

**8. Design Management and Design Review Procedure (Sub-Clause 5.2)**
- 

**9. Quality Management System (Sub-Clause 4.9)**
- 

**10. ESHS - Environment, Social, Health and Safety (Sub-Clause 4.8, 6.7)**
- 

**11. Initial Deliverables and Reporting (Sub-Clause 4.21)**
- 

**12. Communication and Document Control (Sub-Clause 1.3)**
- 

**13. Meeting Arrangements**
- 

**14. Constitution of DAAB (Sub-Clause 21.1, 21.2)**
- 

**15. Contractor's Presentation - Site Establishment**
- 

**16. Any Other Business (AOB)**
- 

**17. Concluding Statement**
- 

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

