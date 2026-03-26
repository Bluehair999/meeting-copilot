import { createIcons, Mic, Play, Square, Users, Volume2, RotateCcw, Book, Upload, Download } from 'lucide';
import { appState } from './state';

export function renderRecordingView(container: HTMLElement) {
  container.innerHTML = `
    <div class="card flex-col gap-2" style="flex-grow: 1; display: flex;">
      <div class="card-header">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="mic"></i> Live Recording
        </h2>
        <div class="control-group" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <select id="source-mode" style="min-width: 130px; font-size: 0.85rem; padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-color);">
            <option value="mic">마이크 단독</option>
            <option value="system">시스템 소리만</option>
            <option value="both" selected>마이크 + 시스템</option>
          </select>
          <div id="mic-wrapper" style="display: flex; align-items: center; gap: 0.5rem;">
            <button id="btn-request-mic" class="btn" style="font-size: 0.85rem; padding: 0.4rem 0.5rem; border-color: var(--primary-color); color: var(--primary-color);">
              마이크 연동 및 검색
            </button>
            <select id="mic-select" class="hidden" style="min-width: 150px; font-size: 0.85rem; padding: 0.4rem 0.5rem;">
              <option value="">권한 허용 필요</option>
            </select>
          </div>
          <div class="lang-group" style="display: flex; gap: 0.5rem; align-items: center; background: var(--surface-color); padding: 0.3rem 0.5rem; border-radius: 4px; border: 1px solid var(--border-color);">
            <div style="display: flex; align-items: center; gap: 0.3rem;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">입력:</span>
              <select id="input-lang" style="font-size: 0.8rem; padding: 0.2rem; border: 1px solid var(--border-color); border-radius: 3px;">
                <option value="ko">Korean</option>
                <option value="en">English</option>
                <option value="pl">Polish</option>
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 0.3rem;">
              <span style="font-size: 0.75rem; color: var(--text-muted);">번역:</span>
              <select id="translate-lang" style="font-size: 0.8rem; padding: 0.2rem; border: 1px solid var(--border-color); border-radius: 3px;">
                <option value="none">필요없음</option>
                <option value="ko">Korean</option>
                <option value="en">English</option>
                <option value="pl">Polish</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="flex-col gap-1">
        <div class="text-sm" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 500;">
          <i data-lucide="users" style="width: 16px;"></i> Participants
        </div>
        <div class="tag-container" id="participant-tags">
          <input type="text" id="tag-input" class="tag-input" placeholder="Enter name/role and press Enter..." />
        </div>
      </div>
      
      <div class="flex-col gap-1">
        <div class="text-sm" style="display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; font-weight: 500;">
          <span style="display: flex; align-items: center; gap: 0.5rem;">
            <i data-lucide="book" style="width: 16px;"></i> Custom Vocabulary (자주 쓰는 단어/전문 용어)
          </span>
          <div style="display: flex; gap: 0.3rem;">
            <button id="btn-import-vocab" class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.2rem;"><i data-lucide="upload" style="width: 14px;"></i> 불러오기</button>
            <button id="btn-export-vocab" class="btn" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; display: flex; align-items: center; gap: 0.2rem;"><i data-lucide="download" style="width: 14px;"></i> 저장하기</button>
          </div>
        </div>
        <div class="tag-container" style="padding: 0;">
          <input type="text" id="custom-vocab" class="tag-input" placeholder="고유명사, 전문용어 등 잘 안들리는 단어를 쉼표(,)로 구분해서 적어주세요..." style="width: 100%; border: none; padding: 0.5rem;" />
        </div>
      </div>

      <div class="script-container flex-col" id="script-container" style="
        background: var(--surface-color-light); 
        border: 1px solid var(--border-color); 
        border-radius: 8px; 
        height: 50vh;
        max-height: 600px;
        min-height: 300px; 
        overflow-y: auto; 
        padding: 0.8rem;
        gap: 0.4rem;
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
      ">
        <div class="text-sm" id="placeholder-text" style="text-align: center; margin: auto;">
          Press Start Request to connect to WebSocket and begin...
        </div>
      </div>

      <div class="recording-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem;">
        <div class="text-sm" id="timeout-display" style="color: var(--danger-color); font-weight: bold; opacity: 0; display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="volume-2" style="width: 16px;"></i> Voice Activity Timeout: <span id="time-val">30</span>s
        </div>
        <div class="action-buttons" style="display: flex; align-items: center; gap: 1rem;">
          <div id="visualizer-container" class="hidden" style="display: flex; align-items: center; gap: 4px; height: 24px; min-width: 40px;">
            <div class="bar" style="width: 4px; height: 10%; background: var(--success-color); border-radius: 2px; transition: height 0.05s ease;"></div>
            <div class="bar" style="width: 4px; height: 10%; background: var(--success-color); border-radius: 2px; transition: height 0.05s ease;"></div>
            <div class="bar" style="width: 4px; height: 10%; background: var(--success-color); border-radius: 2px; transition: height 0.05s ease;"></div>
            <div class="bar" style="width: 4px; height: 10%; background: var(--success-color); border-radius: 2px; transition: height 0.05s ease;"></div>
            <div class="bar" style="width: 4px; height: 10%; background: var(--success-color); border-radius: 2px; transition: height 0.05s ease;"></div>
          </div>
          <button id="btn-simulate" class="btn hidden" style="border-color: var(--accent-color); color: var(--accent-color);">Speak (Simulate VAD)</button>
          <button id="btn-clear" class="btn" style="border-color: var(--danger-color); color: var(--danger-color);"><i data-lucide="rotate-ccw"></i> Reset</button>
          <button id="btn-start" class="btn btn-primary"><i data-lucide="play"></i> Start Recording</button>
          <button id="btn-stop" class="btn hidden"><i data-lucide="square"></i> Stop</button>
        </div>
      </div>
    </div>
  `;

  createIcons({
    icons: { Mic, Play, Square, Users, Volume2, RotateCcw, Book, Upload, Download }
  });

  const tagInput = document.getElementById('tag-input') as HTMLInputElement;
  const tagsContainer = document.getElementById('participant-tags')!;
  const btnStart = document.getElementById('btn-start') as HTMLButtonElement;
  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement;
  const btnSimulate = document.getElementById('btn-simulate') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement;
  const scriptContainer = document.getElementById('script-container')!;
  const timeoutDisplay = document.getElementById('timeout-display')!;
  const timeVal = document.getElementById('time-val')!;
  const micSelect = document.getElementById('mic-select') as HTMLSelectElement;
  const sourceModeSelect = document.getElementById('source-mode') as HTMLSelectElement;
  
  function applyEnvMode() {
    if (appState.isMobileMode) {
      sourceModeSelect.value = 'mic';
      Array.from(sourceModeSelect.options).forEach(opt => {
        if (opt.value !== 'mic') {
          opt.disabled = true;
          if (!opt.text.includes('(미지원)')) opt.text += ' (미지원)';
        }
      });
    } else {
      sourceModeSelect.value = 'both';
      Array.from(sourceModeSelect.options).forEach(opt => {
        opt.disabled = false;
        opt.text = opt.text.replace(' (미지원)', '');
      });
    }
  }

  window.addEventListener('envModeChanged', applyEnvMode);

  applyEnvMode();
  
  const btnExportVocab = document.getElementById('btn-export-vocab') as HTMLButtonElement;
  const btnImportVocab = document.getElementById('btn-import-vocab') as HTMLButtonElement;
  const customVocabInput = document.getElementById('custom-vocab') as HTMLInputElement;

  btnExportVocab?.addEventListener('click', async () => {
    const txt = customVocabInput.value.trim();
    if (!txt) {
      alert("저장할 단어가 없습니다.");
      return;
    }
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: 'Custom_Vocabulary.txt',
          types: [{ description: 'Text File', accept: { 'text/plain': ['.txt'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(txt);
        await writable.close();
        alert('단어장이 성공적으로 저장되었습니다.');
      } else {
        const blob = new Blob([txt], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Custom_Vocabulary.txt';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') alert('저장 중 오류: ' + e.message);
    }
  });

  btnImportVocab?.addEventListener('click', async () => {
    try {
      if ('showOpenFilePicker' in window) {
        const [handle] = await (window as any).showOpenFilePicker({
          types: [{ description: 'Text File', accept: { 'text/plain': ['.txt'] } }],
          multiple: false
        });
        const file = await handle.getFile();
        const text = await file.text();
        customVocabInput.value = text.replace(/[\r\n]+/g, ', ').replace(/^,+|,+$/g, '').trim();
        alert('단어장을 성공적으로 불러왔습니다.');
      } else {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.txt';
        fileInput.onchange = async (e: any) => {
          const file = e.target.files[0];
          if (file) {
            const text = await file.text();
            customVocabInput.value = text.replace(/[\r\n]+/g, ', ').replace(/^,+|,+$/g, '').trim();
            alert('단어장을 성공적으로 불러왔습니다.');
          }
        };
        fileInput.click();
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') alert('불러오기 중 오류: ' + e.message);
    }
  });
  
  let isRecording = false;
  let ws: WebSocket | null = null;
  let timeRemaining = 30;
  let countdownInterval: number | null = null;
  
  // Web Audio Tracking
  let audioContext: AudioContext;
  let analyser: AnalyserNode;
  let stream: MediaStream | null = null;
  let activeStreams: MediaStream[] = [];
  let visualizerAnimationId: number;

  // Initialize from global state in case user goes back
  let fullScriptData: string[] = appState.script ? appState.script.split('\n') : [];

  function renderTags() {
    const inputElement = tagsContainer.querySelector('.tag-input');
    tagsContainer.innerHTML = '';
    
    appState.participants.forEach((p, idx) => {
      const span = document.createElement('span');
      span.className = 'tag';
      span.innerHTML = `${p} <span class="tag-remove" data-idx="${idx}">&times;</span>`;
      tagsContainer.appendChild(span);
    });
    if (inputElement) tagsContainer.appendChild(inputElement);
    
    tagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx')!);
        appState.participants.splice(idx, 1);
        renderTags();
      });
    });
  }

  tagInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && tagInput.value.trim() !== '') {
      appState.participants.push(tagInput.value.trim());
      tagInput.value = '';
      renderTags();
      requestAnimationFrame(() => tagInput.focus());
    }
  });

  // Re-render tags on init
  renderTags();
  
  // Re-render old script lines if revisiting
  if (fullScriptData.length > 0) {
    const ph = document.getElementById('placeholder-text');
    if (ph) ph.remove();
    fullScriptData.forEach(text => {
      const div = document.createElement('div');
      div.style.background = 'var(--surface-color-light)';
      div.style.padding = '0.5rem 0.8rem';
      div.style.borderRadius = '6px';
      div.style.borderLeft = '3px solid var(--primary-color)';
      div.innerHTML = `<div style="white-space: pre-wrap; line-height: 1.4; font-size: 0.95rem;">${text}</div>`;
      scriptContainer.appendChild(div);
    });
    scriptContainer.scrollTop = scriptContainer.scrollHeight;
  }

  const btnRequestMic = document.getElementById('btn-request-mic') as HTMLButtonElement;

  // Populate Microphones
  let hasPopulatedMics = false;
  
  async function populateMicrophones(forceRequest = false) {
    if (hasPopulatedMics && !forceRequest) return;
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      micSelect.innerHTML = '';
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      
      if (audioInputs.length === 0) {
        micSelect.innerHTML = '<option value="">등록된 마이크 없음</option>';
      } else {
        audioInputs.forEach((device, index) => {
          const option = document.createElement('option');
          option.value = device.deviceId;
          option.text = device.label || `마이크 ${index + 1}`;
          micSelect.appendChild(option);
        });
      }
      
      initialStream.getTracks().forEach(track => track.stop());
      hasPopulatedMics = true;
      
      btnRequestMic.classList.add('hidden');
      micSelect.classList.remove('hidden');
    } catch(e: any) {
      console.warn("Mic access denied or unavailable", e);
      micSelect.innerHTML = '<option value="">권한 허용 필요</option>';
      btnRequestMic.classList.remove('hidden');
      micSelect.classList.add('hidden');
      
      if (forceRequest) {
        if (e.name === 'NotAllowedError') {
          alert("마이크 권한이 차단되었습니다! 브라우저 주소창 왼쪽의 🔒 자물쇠 아이콘을 눌러 마이크 권한을 '허용'해주세요.");
        } else if (e.name === 'NotFoundError') {
          alert("PC에 연결된 마이크 하드웨어를 찾을 수 없습니다! 마이크나 헤드셋이 물리적으로 잘 연결되어 있는지 확인해 주세요.");
        } else {
          alert("마이크 연결 오류: " + e.message + " (http 환경 접속 시 브라우저에서 차단했을 수 있습니다.)");
        }
      }
    }
  }
  
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' as any }).then(res => {
      if (res.state === 'granted') {
        populateMicrophones(false).then(() => {
          const savedMic = localStorage.getItem('selectedMic');
          if (savedMic && hasPopulatedMics) micSelect.value = savedMic;
        });
      }
    }).catch(e => console.log('Permission query not supported', e));
  }

  btnRequestMic.addEventListener('click', async () => {
    await populateMicrophones(true);
    const savedMic = localStorage.getItem('selectedMic');
    if (savedMic && hasPopulatedMics) micSelect.value = savedMic;
  });

  micSelect.addEventListener('change', () => {
    localStorage.setItem('selectedMic', micSelect.value);
  });

  // Audio Visualizer Logic
  async function startAudioMonitoring(sourceMode: string, deviceId?: string) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const dest = audioContext.createMediaStreamDestination();
    activeStreams = [];

    try {
      if (sourceMode === 'mic' || sourceMode === 'both') {
        const micStream = await navigator.mediaDevices.getUserMedia({ 
          audio: deviceId ? { deviceId: { exact: deviceId } } : true 
        });
        activeStreams.push(micStream);
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(dest);
      }

      if (sourceMode === 'system' || sourceMode === 'both') {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
          alert("모바일 환경 또는 보안되지 않은 연결에서는 '시스템 소리'를 가져올 수 없습니다. 오디오 입력 모드를 '마이크 단독'으로 변경해 주세요.");
          throw new Error("시스템 소리 캡처 미지원 환경 (getDisplayMedia is undefined)");
        }
        const sysStream = await navigator.mediaDevices.getDisplayMedia({ 
          audio: true, 
          video: true // Chrome needs video:true to prompt tab sharing
        });
        activeStreams.push(sysStream);
        
        const sysAudioTracks = sysStream.getAudioTracks();
        if (sysAudioTracks.length > 0) {
          const justAudioStream = new MediaStream([sysAudioTracks[0]]);
          const sysSource = audioContext.createMediaStreamSource(justAudioStream);
          sysSource.connect(dest);
        } else {
          alert("오디오 트랙이 없습니다! 크롬 권한 창 아래쪽의 '탭 오디오도 공유' 옵션을 꼭 켜주세요.");
        }
      }
    } catch (e: any) {
      alert("스트림 권한을 가져오는데 실패했습니다: " + e.message);
      throw e;
    }

    stream = dest.stream; 
    
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const mixedSource = audioContext.createMediaStreamSource(stream);
    mixedSource.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = document.querySelectorAll('#visualizer-container .bar') as NodeListOf<HTMLElement>;
    document.getElementById('visualizer-container')?.classList.remove('hidden');

    function draw() {
      visualizerAnimationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      const step = Math.floor(dataArray.length / 5);
      let maxAvg = 0;
      for(let i = 0; i < 5; i++) {
        let sum = 0;
        for(let j = 0; j < step; j++) {
          sum += dataArray[i*step + j];
        }
        const avg = sum / step;
        maxAvg = Math.max(maxAvg, avg);
        const heightPercent = Math.max(10, (avg / 255) * 100);
        bars[i].style.height = `${heightPercent}%`;
        
        if (avg > 150) bars[i].style.background = 'var(--danger-color)';
        else if (avg > 80) bars[i].style.background = 'var(--primary-color)';
        else bars[i].style.background = 'var(--success-color)';
      }

      // Auto-trigger WebSocket if there is noticeable sound (VAD threshold)
      if (maxAvg > 15 && isRecording && ws && ws.readyState === WebSocket.OPEN) {
         // UI Feedback only
      }
    }
    draw();
  }

  let recorderInterval: number | null = null;

  function stopAudioMonitoring() {
    if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
    if (recorderInterval) clearInterval(recorderInterval);
    activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    activeStreams = [];
    if (audioContext) audioContext.close();
    document.getElementById('visualizer-container')?.classList.add('hidden');
  }

  function startVADTimer() {
    clearVADTimer();
    timeRemaining = 30;
    timeoutDisplay.style.opacity = '1';
    timeVal.innerText = timeRemaining.toString();
    
    countdownInterval = window.setInterval(() => {
      timeRemaining--;
      timeVal.innerText = timeRemaining.toString();
      if (timeRemaining <= 0) stopRecording(true);
    }, 1000);
  }

  function clearVADTimer() {
    if (countdownInterval) window.clearInterval(countdownInterval);
    timeoutDisplay.style.opacity = '0';
  }

  const inputLangSelect = document.getElementById('input-lang') as HTMLSelectElement;
  const translateLangSelect = document.getElementById('translate-lang') as HTMLSelectElement;

  function addScriptLine(data: any | string) {
    const ph = document.getElementById('placeholder-text');
    if (ph) ph.remove();

    const isScrolledToBottom = scriptContainer.scrollHeight - scriptContainer.clientHeight <= scriptContainer.scrollTop + 10;
    
    const div = document.createElement('div');
    div.style.background = 'var(--surface-color-light)';
    div.style.padding = '0.5rem 0.8rem';
    div.style.borderRadius = '6px';
    div.style.borderLeft = '3px solid var(--primary-color)';
    div.style.display = 'flex';
    div.style.flexDirection = 'column';
    div.style.gap = '0.2rem';

    let plainText = "";
    if (typeof data === 'string') {
        div.innerHTML = `<div style="color: var(--text-main); font-weight: 500;">${data}</div>`;
        plainText = data;
    } else if (data.text) {
        const displayText = data.text;
        div.innerHTML = `<div style="color: var(--text-main); font-weight: 500;">${displayText}</div>`;
        plainText = displayText;
    } else {
        div.innerHTML = `
          <div style="color: var(--text-muted); font-size: 0.85rem;">[원문] ${data.original}</div>
          <div style="color: var(--text-main); font-weight: 500;">[번역] ${data.translated}</div>
        `;
        plainText = `[원문] ${data.original}\n[번역] ${data.translated}`;
    }

    div.animate([{opacity: 0, transform: 'translateY(10px)'}, {opacity: 1, transform: 'translateY(0)'}], {duration: 300, easing: 'ease-out'});
    
    scriptContainer.appendChild(div);
    fullScriptData.push(plainText);
    
    if (isScrolledToBottom) {
      scriptContainer.scrollTop = scriptContainer.scrollHeight;
    }
  }

  btnStart.addEventListener('click', async () => {
    isRecording = true;
    scriptContainer.innerHTML = '';
    fullScriptData = [];
    appState.analysisResult = '';
    btnStart.classList.add('hidden');
    
    const inputLang = inputLangSelect.value;
    const translateLang = translateLangSelect.value;
    const sourceMode = (document.getElementById('source-mode') as HTMLSelectElement).value;
    const selectedDeviceId = micSelect.value;
    const customVocab = (document.getElementById('custom-vocab') as HTMLInputElement).value;
    
    // Start hardware monitoring
    try {
      await startAudioMonitoring(sourceMode, selectedDeviceId);
    } catch(e) {
      alert("오디오 장치 및 브라우저 권한 획득에 실패했습니다. 녹음을 취소합니다.");
      isRecording = false;
      btnStart.classList.remove('hidden');
      return;
    }

    btnStop.classList.remove('hidden');
    btnSimulate.classList.remove('hidden');
    
    const backendHost = import.meta.env.VITE_BACKEND_URL || `${window.location.hostname}:8000`;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${wsProtocol}//${backendHost}/ws/record`);
    ws.onopen = () => {
      ws!.send(JSON.stringify({ type: "init", inputLang, translateLang, apiKey: appState.openaiApiKey, customVocab }));
      
      const tlText = translateLang === 'none' ? '없음' : translateLangSelect.options[translateLangSelect.selectedIndex].text;
      addScriptLine(`[System] AI 연결 완료 (입력: ${inputLangSelect.options[inputLangSelect.selectedIndex].text}, 번역: ${tlText}). 오디오 분석 시작...`);
      
      // Every 5 seconds, send an audio chunk
      recorderInterval = window.setInterval(() => {
        if (!isRecording || !stream) {
          if (recorderInterval) clearInterval(recorderInterval);
          return;
        }
        
        try {
          const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
          const chunks: BlobPart[] = [];
          recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          recorder.onstop = async () => {
             const blob = new Blob(chunks, { type: 'audio/webm' });
             if (blob.size > 1000 && ws && ws.readyState === WebSocket.OPEN) { 
                const buffer = await blob.arrayBuffer();
                ws.send(buffer);
             }
          };
          recorder.start();
          setTimeout(() => { if (recorder.state === "recording") recorder.stop(); }, 5000);
        } catch (err) {
          console.error("MediaRecorder error", err);
        }
      }, 5000);

      startVADTimer();
    };
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      addScriptLine(data);
      startVADTimer(); // Reset VAD on voice activity
    };
    ws.onerror = (e) => {
      console.error(e);
      addScriptLine('[Error] Failed to connect to backend STT server. Make sure FastAPI server is running.');
    };
  });

  function stopRecording(isTimeout = false) {
    if (!isRecording) return;
    isRecording = false;
    clearVADTimer();
    stopAudioMonitoring();
    btnStop.classList.add('hidden');
    btnSimulate.classList.add('hidden');
    btnStart.classList.remove('hidden');
    if (ws) ws.close();
    
    if (isTimeout) {
      alert("무음으로 인해 녹음이 자동 종료되었습니다. (Recording stopped due to 30s silence)");
      addScriptLine('[System] Recording stopped due to 30s voice inactivity timeout.');
    } else {
      addScriptLine('[System] Recording stopped manually.');
    }

    const compiledScript = fullScriptData.join('\n');
    appState.script = compiledScript;
    const evt = new CustomEvent('recordingEnded');
    window.dispatchEvent(evt);
  }

  btnStop.addEventListener('click', () => stopRecording(false));

  btnSimulate.addEventListener('click', () => {
    if (isRecording && ws?.readyState === WebSocket.OPEN) {
      ws.send("Dummy voice input");
    }
  });

  btnClear.addEventListener('click', () => {
    if (confirm("정말로 모든 녹음 내용을 지우고 처음부터 다시 시작하시겠습니까? (이 작업은 되돌릴 수 없습니다.)")) {
      fullScriptData = [];
      appState.script = "";
      appState.analysisResult = "";
      scriptContainer.innerHTML = '';
      const ph = document.createElement('div');
      ph.id = 'placeholder-text';
      ph.className = 'text-sm';
      ph.style.textAlign = 'center';
      ph.style.margin = 'auto';
      ph.innerText = 'Press Start Request to connect to WebSocket and begin...';
      scriptContainer.appendChild(ph);
    }
  });

}
