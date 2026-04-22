import { createIcons, Mic, Play, Square, Volume2, RotateCcw, Languages, ArrowLeftRight, Monitor, Smartphone } from 'lucide';
import { appState } from './state';

export function renderLiveTransView(container: HTMLElement) {
  container.innerHTML = `
    <div class="interpreter-container">
      <div class="card flex-col gap-2" style="padding: 1rem;">
        <div class="card-header" style="margin-bottom: 0.5rem;">
          <h2 style="display: flex; align-items: center; gap: 0.5rem; font-size: 1.2rem;">
            <i data-lucide="languages" style="color: var(--primary-color);"></i> Live Interpreter
          </h2>
          <div class="control-group" style="display: flex; gap: 0.5rem; align-items: center;">
             <div id="vad-indicator" class="hidden" style="width: 12px; height: 12px; border-radius: 50%; background: var(--success-color); box-shadow: 0 0 10px var(--success-color);"></div>
             <span id="status-text" class="text-sm">Ready to assist</span>
          </div>
        </div>

        <div class="flex-row gap-2" style="align-items: center; justify-content: center; background: var(--surface-color-light); padding: 0.8rem; border-radius: 12px; border: 1px solid var(--border-color);">
          <div class="flex-col" style="flex: 1; align-items: center; gap: 0.3rem;">
            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Input</span>
            <select id="live-input-lang" style="width: 100%; text-align: center; font-weight: 600;">
              <option value="auto">Auto Detect (KR-PL)</option>
              <option value="ko">Korean</option>
              <option value="en">English</option>
              <option value="pl">Polish</option>
            </select>
          </div>
          
          <button id="btn-swap-lang" class="lang-swap-btn" title="Swap Languages">
            <i data-lucide="arrow-left-right" style="width: 18px;"></i>
          </button>

          <div class="flex-col" style="flex: 1; align-items: center; gap: 0.3rem;">
            <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase;">Output</span>
            <select id="live-translate-lang" style="width: 100%; text-align: center; font-weight: 600;">
              <option value="ko">Korean</option>
              <option value="en" selected>English</option>
              <option value="pl" selected>Polish</option>
            </select>
          </div>
        </div>

        <div class="flex-row gap-2" style="font-size: 0.85rem; padding: 0 0.5rem;">
           <select id="live-source-mode" style="padding: 0.3rem; font-size: 0.8rem;">
            <option value="mic">마이크 단독</option>
            <option value="system">시스템 소리만</option>
            <option value="both" selected>마이크 + 시스템</option>
          </select>
          <select id="live-mic-select" class="hidden" style="flex-grow: 1; padding: 0.3rem; font-size: 0.8rem;">
          </select>
          <button id="btn-live-request-mic" class="btn btn-sm" style="flex-grow: 1; font-size: 0.75rem;">마이크 연동</button>
        </div>
      </div>

      <div class="chat-container" id="live-chat-container">
        <div id="live-placeholder" style="text-align: center; margin: auto; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem;">
          <i data-lucide="mic" style="width: 48px; height: 48px; opacity: 0.2;"></i>
          <p>통역을 시작하려면 하단의 'Start' 버튼을 눌러주세요.<br><span style="font-size: 0.8rem;">동시 통역 모드에서는 대화 내용이 채팅 형태로 표시됩니다.</span></p>
        </div>
      </div>

      <div class="live-footer">
        <div style="display: flex; align-items: center; gap: 1rem;">
            <div id="live-visualizer" class="hidden" style="display: flex; align-items: center; gap: 3px; height: 20px;">
                <div class="bar" style="width: 3px; height: 20%; background: var(--primary-color); border-radius: 1px;"></div>
                <div class="bar" style="width: 3px; height: 20%; background: var(--primary-color); border-radius: 1px;"></div>
                <div class="bar" style="width: 3px; height: 20%; background: var(--primary-color); border-radius: 1px;"></div>
                <div class="bar" style="width: 3px; height: 20%; background: var(--primary-color); border-radius: 1px;"></div>
            </div>
            <span id="live-timer" class="text-sm hidden" style="font-weight: 600; color: var(--danger-color);">Silence Timeout: 60s</span>
        </div>
        
        <div class="action-buttons">
          <button id="btn-live-clear" class="btn" title="대화 기록 초기화"><i data-lucide="rotate-ccw"></i></button>
          <button id="btn-live-start" class="btn btn-primary" style="padding-left: 2rem; padding-right: 2rem;">
            <i data-lucide="play"></i> Start Interpretation
          </button>
          <button id="btn-live-stop" class="btn btn-primary hidden" style="background: var(--danger-color); padding-left: 2rem; padding-right: 2rem;">
            <i data-lucide="square"></i> Stop
          </button>
        </div>
      </div>
    </div>
  `;

  createIcons({
    icons: { Mic, Play, Square, Volume2, RotateCcw, Languages, ArrowLeftRight, Monitor, Smartphone }
  });

  // UI elements
  const chatContainer = document.getElementById('live-chat-container')!;
  const btnStart = document.getElementById('btn-live-start') as HTMLButtonElement;
  const btnStop = document.getElementById('btn-live-stop') as HTMLButtonElement;
  const btnClear = document.getElementById('btn-live-clear') as HTMLButtonElement;
  const btnSwap = document.getElementById('btn-swap-lang') as HTMLButtonElement;
  const btnRequestMic = document.getElementById('btn-live-request-mic') as HTMLButtonElement;
  const inputLangSelect = document.getElementById('live-input-lang') as HTMLSelectElement;
  const outputLangSelect = document.getElementById('live-translate-lang') as HTMLSelectElement;
  const sourceModeSelect = document.getElementById('live-source-mode') as HTMLSelectElement;
  const micSelect = document.getElementById('live-mic-select') as HTMLSelectElement;
  const statusText = document.getElementById('status-text')!;
  const vadIndicator = document.getElementById('vad-indicator')!;
  const liveTimer = document.getElementById('live-timer')!;

  // Load state
  inputLangSelect.value = appState.liveInputLang;
  outputLangSelect.value = appState.liveTranslateLang;

  // Logic state
  let isRunning = false;
  let ws: WebSocket | null = null;
  let audioContext: AudioContext;
  let analyser: AnalyserNode;
  let stream: MediaStream | null = null;
  let activeStreams: MediaStream[] = [];
  let visualizerAnimationId: number;
  let timeRemaining = 60;
  let countdownInterval: number | null = null;
  let heartbeatInterval: number | null = null;

  function getFlag(lang: string) {
    if (!lang) return '🌐';
    const l = lang.toLowerCase();
    if (l.includes('ko')) return '🇰🇷';
    if (l.includes('pl')) return '🇵🇱';
    if (l.includes('en')) return '🇺🇸';
    return '🌐';
  }

  // Render existing bubbles
  function renderBubbles() {
    if (appState.liveTransData.length > 0) {
      document.getElementById('live-placeholder')?.classList.add('hidden');
      chatContainer.innerHTML = '';
      appState.liveTransData.forEach((data) => {
        addBubbleUI(data);
      });
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  function addBubbleUI(data: any) {
    document.getElementById('live-placeholder')?.classList.add('hidden');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble bubble-received';
    bubble.style.maxWidth = '90%';
    bubble.style.width = 'fit-content';
    
    // 소스/타겟 언어 표시 (상호 통역 모드 대응)
    const sourceFlag = getFlag(data.source_lang || inputLangSelect.value);
    const targetFlag = getFlag(data.target_lang || outputLangSelect.value);

    bubble.innerHTML = `
      <div class="bubble-original" style="display: flex; align-items: center; gap: 0.4rem;">
        <span style="font-size: 1.1rem;">${sourceFlag}</span> ${data.original}
      </div>
      <div class="bubble-translated" style="display: flex; align-items: center; gap: 0.6rem;">
        <span style="font-size: 1.3rem;">${targetFlag}</span> ${data.translated}
      </div>
    `;
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  renderBubbles();

  // Language Swap
  btnSwap.addEventListener('click', () => {
    const temp = inputLangSelect.value;
    inputLangSelect.value = outputLangSelect.value;
    outputLangSelect.value = temp;
    appState.liveInputLang = inputLangSelect.value;
    appState.liveTranslateLang = outputLangSelect.value;
  });

  inputLangSelect.addEventListener('change', () => appState.liveInputLang = inputLangSelect.value);
  outputLangSelect.addEventListener('change', () => appState.liveTranslateLang = outputLangSelect.value);

  // Mic Handling (Simplified from RecordingView)
  async function populateMicrophones() {
    try {
      const initialStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      micSelect.innerHTML = '';
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      audioInputs.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        option.text = device.label || `마이크 ${index + 1}`;
        micSelect.appendChild(option);
      });
      initialStream.getTracks().forEach(track => track.stop());
      btnRequestMic.classList.add('hidden');
      micSelect.classList.remove('hidden');
    } catch(e) {
      console.warn("Mic access denied", e);
    }
  }

  btnRequestMic.addEventListener('click', populateMicrophones);

  // Start Interpretation
  btnStart.addEventListener('click', async () => {
    isRunning = true;
    btnStart.disabled = true;
    btnStart.innerHTML = '<i class="animate-spin">⌛</i> Connecting...';
    
    const inputLang = inputLangSelect.value;
    const translateLang = outputLangSelect.value;
    const sourceMode = sourceModeSelect.value;
    const deviceId = micSelect.value;

    const backendHost = import.meta.env.VITE_BACKEND_URL || `${window.location.hostname}:8000`;
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    const wsPromise = new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(`${wsProtocol}//${backendHost}/ws/record`);
        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "init", inputLang, translateLang, apiKey: appState.openaiApiKey }));
            resolve(socket);
        };
        socket.onerror = () => reject(new Error("Server connection failed"));
        setTimeout(() => reject(new Error("Timeout")), 10000);
    });

    try {
      // Setup Audio
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = audioContext.createMediaStreamDestination();
      
      if (sourceMode === 'mic' || sourceMode === 'both') {
        const micStream = await navigator.mediaDevices.getUserMedia({ 
            audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true } 
        });
        activeStreams.push(micStream);
        audioContext.createMediaStreamSource(micStream).connect(dest);
      }
      
      if (sourceMode === 'system' || sourceMode === 'both') {
        const sysStream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
        activeStreams.push(sysStream);
        const tracks = sysStream.getAudioTracks();
        if (tracks.length > 0) audioContext.createMediaStreamSource(new MediaStream([tracks[0]])).connect(dest);
      }

      stream = dest.stream;
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      audioContext.createMediaStreamSource(stream).connect(analyser);

      ws = await wsPromise;

      // Start processing
      statusText.innerText = "Interpreting LIVE";
      statusText.style.color = "var(--primary-color)";
      btnStart.classList.add('hidden');
      btnStop.classList.remove('hidden');
      document.getElementById('live-visualizer')?.classList.remove('hidden');
      liveTimer.classList.remove('hidden');

      let currentRecorder: MediaRecorder | null = null;
      let lastCutTimestamp = Date.now();
      let lastLoudSoundTimestamp = Date.now();

      const bars = document.querySelectorAll('#live-visualizer .bar') as NodeListOf<HTMLElement>;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      function draw() {
        if (!isRunning) return;
        visualizerAnimationId = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        
        let maxAvg = 0;
        const step = Math.floor(dataArray.length / 4);
        for(let i=0; i<4; i++) {
           let sum = 0; for(let j=0; j<step; j++) sum += dataArray[i*step+j];
           const avg = sum/step;
           maxAvg = Math.max(maxAvg, avg);
           bars[i].style.height = `${Math.max(20, (avg/255)*100)}%`;
        }

        if (maxAvg > 15) {
            vadIndicator.classList.remove('hidden');
            vadIndicator.classList.add('vad-pulse-active');
            lastLoudSoundTimestamp = Date.now();
            timeRemaining = 60;
        } else {
            vadIndicator.classList.remove('vad-pulse-active');
        }

        const now = Date.now();
        const elapsed = now - lastCutTimestamp;
        const silence = now - lastLoudSoundTimestamp;

        if ((elapsed >= 3000 && silence >= 600) || elapsed >= 10000) {
          cut();
        }
      }

      function cut() {
        if (!isRunning || !stream || !ws || ws.readyState !== WebSocket.OPEN) return;
        const next = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        const chunks: BlobPart[] = [];
        next.ondataavailable = e => chunks.push(e.data);
        next.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            if (blob.size > 500 && ws && ws.readyState === WebSocket.OPEN) ws.send(await blob.arrayBuffer());
        };
        next.start();
        if (currentRecorder) { 
            const prev = currentRecorder; 
            setTimeout(() => { try { prev.stop(); } catch(e) {} }, 500); 
        }
        currentRecorder = next;
        lastCutTimestamp = Date.now();
      }

      draw();
      cut();

      ws.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.original && data.translated) {
            appState.liveTransData.push(data);
            addBubbleUI(data);
            timeRemaining = 60; // Reset on activity
        } else if (data.text) {
            // 번역 없는 단일 텍스트 처리
            const singleData = { original: data.text, translated: '-', source_lang: data.source_lang };
            appState.liveTransData.push(singleData);
            addBubbleUI(singleData);
            timeRemaining = 60;
        }
      };

      countdownInterval = window.setInterval(() => {
          timeRemaining--;
          liveTimer.innerText = `Silence Timeout: ${timeRemaining}s`;
          if (timeRemaining <= 0) stop();
      }, 1000);

      heartbeatInterval = window.setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 30000);

    } catch (e: any) {
      alert("Error: " + e.message);
      stop();
    } finally {
      btnStart.disabled = false;
      btnStart.innerHTML = '<i data-lucide="play"></i> Start Interpretation';
    }
  });

  function stop() {
    isRunning = false;
    if (ws) ws.close();
    if (audioContext) audioContext.close();
    if (visualizerAnimationId) cancelAnimationFrame(visualizerAnimationId);
    if (countdownInterval) clearInterval(countdownInterval);
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    activeStreams.forEach(s => s.getTracks().forEach(t => t.stop()));
    activeStreams = [];
    
    btnStop.classList.add('hidden');
    btnStart.classList.remove('hidden');
    document.getElementById('live-visualizer')?.classList.add('hidden');
    liveTimer.classList.add('hidden');
    statusText.innerText = "Ready to assist";
    statusText.style.color = "var(--text-muted)";
    vadIndicator.classList.add('hidden');
  }

  btnStop.addEventListener('click', stop);

  btnClear.addEventListener('click', () => {
    if (confirm("대화 기록을 모두 삭제하시겠습니까?")) {
      appState.liveTransData = [];
      chatContainer.innerHTML = '';
      document.getElementById('live-placeholder')?.classList.remove('hidden');
    }
  });
}
