import { createIcons, FileText, CheckCircle, Clock } from 'lucide';
import { appState } from './state';

export function renderAnalysisView(container: HTMLElement) {
  container.innerHTML = `
    <div class="card flex-col gap-2" style="animation: fadeIn 0.5s ease-out; flex-grow: 1;">
      <div class="card-header">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="file-text"></i> AI Analysis Dashboard
        </h2>
      </div>
      
      <p class="text-sm">Recording finished. The script length is <strong>${appState.script.length} characters</strong>. Please choose an analysis mode:</p>
      
      <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
        <button id="btn-full" class="btn" style="flex: 1; min-height: 100px; flex-direction: column; gap: 0.5rem;">
          <i data-lucide="clock" style="width: 28px; height: 28px;"></i>
          <div>
            <strong>Full Report</strong>
            <div class="text-sm">Context & conversation flow preservation</div>
          </div>
        </button>
        <button id="btn-summary" class="btn btn-primary" style="flex: 1; min-height: 100px; flex-direction: column; gap: 0.5rem;">
          <i data-lucide="check-circle" style="width: 28px; height: 28px;"></i>
          <div>
            <strong>Summary Mode</strong>
            <div class="text-sm">Decisions & Action Items</div>
          </div>
        </button>
      </div>

      <div id="result-container" class="hidden flex-col gap-2" style="margin-top: 1.5rem; flex-grow: 1;">
        <h3 id="result-title" style="border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">Analysis Result</h3>
        
        <!-- Skeleton UI -->
        <div id="skeleton-ui" class="hidden" style="display: flex; flex-direction: column; gap: 0.75rem; padding: 1rem;">
          <div style="height: 16px; background: var(--border-color); border-radius: 4px; animation: pulse 1.5s infinite; width: 40%;"></div>
          <div style="height: 16px; background: var(--border-color); border-radius: 4px; animation: pulse 1.5s infinite; width: 100%;"></div>
          <div style="height: 16px; background: var(--border-color); border-radius: 4px; animation: pulse 1.5s infinite; width: 80%;"></div>
          <div style="height: 16px; background: var(--border-color); border-radius: 4px; animation: pulse 1.5s infinite; width: 90%;"></div>
        </div>

        <div id="analysis-content" class="script-container hidden" style="
          background: var(--bg-color); 
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 1.5rem;
          min-height: 200px;
          line-height: 1.6;
          white-space: pre-wrap;
          font-size: 0.95rem;
          color: var(--text-main);
          box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);
        "></div>
        
        <button id="btn-next" class="btn btn-primary hidden" style="align-self: flex-end; margin-top: auto;">
          Proceed to Document Export
        </button>
      </div>
    </div>
  `;

  createIcons({
    icons: { FileText, CheckCircle, Clock }
  });

  const btnFull = document.getElementById('btn-full') as HTMLButtonElement;
  const btnSummary = document.getElementById('btn-summary') as HTMLButtonElement;
  const resultContainer = document.getElementById('result-container')!;
  const skeletonUi = document.getElementById('skeleton-ui')!;
  const analysisContent = document.getElementById('analysis-content')!;
  const btnNext = document.getElementById('btn-next')!;
  let currentResult = appState.analysisResult;

  if (currentResult) {
    resultContainer.classList.remove('hidden');
    skeletonUi.classList.add('hidden');
    analysisContent.innerHTML = currentResult.replace(/\n/g, '<br>');
    analysisContent.classList.remove('hidden');
    btnNext.classList.remove('hidden');
  }

  async function performAnalysis(isSummary: boolean) {
    resultContainer.classList.remove('hidden');
    skeletonUi.classList.remove('hidden');
    analysisContent.classList.add('hidden');
    btnNext.classList.add('hidden');
    
    btnFull.disabled = true;
    btnFull.style.opacity = '0.5';
    btnSummary.disabled = true;
    btnSummary.style.opacity = '0.5';

    try {
      const now = new Date();
      const kstTime = now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      
      const payload = { 
        script: appState.script, 
        is_summary: isSummary, 
        api_key: appState.openaiApiKey,
        participants: appState.participants,
        recording_time: kstTime
      };

      const backendHost = import.meta.env.VITE_BACKEND_URL || `${window.location.hostname}:8000`;
      const res = await fetch(`${window.location.protocol}//${backendHost}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      currentResult = data.result;
      appState.analysisResult = currentResult;
      
      skeletonUi.classList.add('hidden');
      analysisContent.innerHTML = currentResult.replace(/\n/g, '<br>');
      analysisContent.classList.remove('hidden');
      analysisContent.animate([{opacity: 0}, {opacity: 1}], {duration: 400});
      btnNext.classList.remove('hidden');
    } catch (e) {
      alert("Failed to connect to backend");
      skeletonUi.classList.add('hidden');
    } finally {
      btnFull.disabled = false;
      btnFull.style.opacity = '1';
      btnSummary.disabled = false;
      btnSummary.style.opacity = '1';
    }
  }

  btnFull.addEventListener('click', () => performAnalysis(false));
  btnSummary.addEventListener('click', () => performAnalysis(true));

  btnNext.addEventListener('click', () => {
    appState.analysisResult = currentResult;
    const evt = new CustomEvent('analysisEnded');
    window.dispatchEvent(evt);
  });
}
