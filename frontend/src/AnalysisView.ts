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
      
      <div style="display: flex; gap: 1rem; align-items: center; margin-top: 0.5rem; background: var(--surface-color-light); padding: 0.8rem; border-radius: 6px; border: 1px solid var(--border-color);">
        <span class="text-sm" style="font-weight: 600; min-width: max-content;">📝 요약 양식(Template): </span>
        <select id="template-select" style="flex: 1; padding: 0.4rem; border-radius: 4px; border: 1px solid var(--border-color); font-size: 0.9rem;">
          <option value="general">일반 회의 요약 (General Summary)</option>
          <option value="kickoff_trc">Kick-off Meeting (Dohwa-JV SGR)</option>
        </select>
      </div>
      
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
  let currentIsSummary = false;

  function renderResult(content: string, isSummary: boolean) {
    analysisContent.innerHTML = '';
    currentIsSummary = isSummary;
    
    // Safety check to ensure we display something
    if (!content) {
      analysisContent.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 2rem;">분석 결과가 비어있습니다.</div>';
      return;
    }

    if (isSummary) {
      // Summary Mode: Render Markdown to HTML and inject custom styles for tables
      let parsedHTML = "";
      if ((window as any).marked) {
        parsedHTML = (window as any).marked.parse(content);
      } else {
        parsedHTML = content.replace(/\n/g, '<br>');
      }
      
      const customStyles = `
        <style>
          .markdown-body table { width: 100%; border-collapse: collapse; margin-top: 5px; margin-bottom: 20px; font-family: 'Arial', sans-serif; }
          .markdown-body th, .markdown-body td { border: 1px solid #000; padding: 6px 12px; text-align: left; vertical-align: top; }
          .markdown-body th { background-color: #4B5563; color: white; font-weight: bold; border-color: #000; }
          .markdown-body td { background-color: #ffffff; color: #111; border-color: #000;}
          .markdown-body h1 { font-family: 'Arial', sans-serif; font-size: 1.4rem; text-align: center; margin-bottom: 15px; color: #1e3a8a; font-weight: bold; }
          .markdown-body h2 { font-family: 'Arial', sans-serif; font-size: 1.05rem; background-color: #e5e7eb; padding: 6px 10px; border: 1px solid #000; margin-top: 15px; margin-bottom: 5px; color: #000; font-weight: bold; }
          .markdown-body ul { margin-top: 0; padding-left: 25px; margin-bottom: 10px; }
          .markdown-body li { margin-bottom: 4px; color: #111; font-family: 'Arial', sans-serif; }
          .markdown-body p { margin-top: 0; margin-bottom: 8px; color: #111; font-family: 'Arial', sans-serif; }
          .markdown-body strong { font-weight: bold; color: #000; }
          .markdown-body hr { border: none; border-top: 2px solid #000; margin: 20px 0; }
        </style>
      `;
      analysisContent.innerHTML = customStyles + `<div class="markdown-body" style="background-color: #ffffff; padding: 20px; border-radius: 4px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #d1d5db;">${parsedHTML}</div>`;
    } else {
      // Full Report: Build with interactive checkboxes using template string for robustness
      const lines = content.split('\n');
      const headerLine = lines.find(l => l.startsWith('##')) || "🎙️ 전체 회의 스크립트";
      const conversationLines = lines.filter(l => l.trim() && !l.startsWith('##'));

      let html = `
        <div class="report-header-area" style="font-weight: 600; font-size: 1.05rem; margin-bottom: 1rem; color: var(--primary-color);">
          ${headerLine}
        </div>
        <div class="report-controls">
          <button id="btn-select-all" class="btn" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">전체 선택</button>
          <button id="btn-deselect-all" class="btn" style="padding: 0.25rem 0.6rem; font-size: 0.8rem;">전체 해제</button>
          <span style="color: var(--text-muted); margin-left: 0.5rem;">💡 제외할 대화의 체크를 해제하고 <b>[Summary Mode]</b>를 눌러주세요.</span>
        </div>
        <div class="report-items-container" style="display: flex; flex-direction: column;">
      `;

      conversationLines.forEach((line) => {
        html += `
          <label class="report-item">
            <input type="checkbox" class="report-item-checkbox" checked />
            <div class="report-item-text">${line}</div>
          </label>
        `;
      });

      html += `</div>`;
      analysisContent.innerHTML = html;

      // Event listeners for select/deselect all
      const btnAll = document.getElementById('btn-select-all');
      const btnNone = document.getElementById('btn-deselect-all');
      
      if (btnAll) btnAll.onclick = (e) => {
        e.preventDefault();
        analysisContent.querySelectorAll('.report-item-checkbox').forEach((cb: any) => cb.checked = true);
      };
      if (btnNone) btnNone.onclick = (e) => {
        e.preventDefault();
        analysisContent.querySelectorAll('.report-item-checkbox').forEach((cb: any) => cb.checked = false);
      };
    }
  }

  if (currentResult) {
    resultContainer.classList.remove('hidden');
    skeletonUi.classList.add('hidden');
    renderResult(currentResult, false); // Assume it was full report if returning
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
      
      let scriptToUse = appState.script;
      
      // If we are requesting a summary and we currently have a full report (not a summary)
      if (isSummary && !currentIsSummary) {
        const checkedItems = Array.from(analysisContent.querySelectorAll('.report-item-checkbox:checked')) as HTMLInputElement[];
        if (checkedItems.length > 0) {
          // Collect text only from checked items
          scriptToUse = checkedItems.map(cb => {
            const wrapper = cb.closest('.report-item');
            return wrapper ? (wrapper.querySelector('.report-item-text') as HTMLElement).innerText : "";
          }).filter(t => t).join('\n');
          console.log("Generating summary from selected lines. Item count:", checkedItems.length);
        }
      }

      const templateType = (document.getElementById('template-select') as HTMLSelectElement).value;

      const payload = { 
        script: scriptToUse, 
        is_summary: isSummary,
        template_type: templateType,
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
      renderResult(currentResult, isSummary);
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
