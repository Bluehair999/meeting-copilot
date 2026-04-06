import './style.css'
import { createIcons, Mic, FileText, Download, Users, Smartphone, Monitor } from 'lucide';
import { renderRecordingView } from './RecordingView';
import { renderAnalysisView } from './AnalysisView';
import { renderExportView } from './ExportView';
import { appState } from './state';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="app-header" style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-color); padding-bottom: 1rem;">
    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
      <div style="display: flex; align-items: center; gap: 0.5rem;">
        <i data-lucide="mic" style="color: var(--primary-color);"></i>
        <h1 class="text-gradient" style="margin: 0; line-height: 1;">MEETING Copilot</h1>
        <button id="btn-env-toggle" class="btn btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; margin-left: 1rem; border-color: var(--border-color); display: flex; align-items: center; gap: 0.3rem;" title="PC/모바일 모드 전환">
          <i data-lucide="${appState.isMobileMode ? 'smartphone' : 'monitor'}" id="env-icon" style="width: 14px; height: 14px;"></i> <span id="env-text">${appState.isMobileMode ? '모바일 환경' : 'PC 환경'}</span>
        </button>
      </div>
      <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.5rem; padding-left: 2rem;">
        <span style="font-weight: 900; color: #007a5e; letter-spacing: 0.5px; font-family: sans-serif;">DOHWA</span>
        <span style="font-weight: 600; color: var(--accent-color);">교통부문 AI</span>
      </div>
    </div>
    <div id="status-indicator" class="text-sm api-controls" style="display: flex; align-items: center; gap: 0.5rem;">
      <input type="password" id="api-key-input" class="api-key-input" placeholder="OpenAI API Key" style="width: 200px; padding: 0.3rem 0.5rem; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--border-color); background: var(--bg-color); color: var(--text-main);" />
      <button id="btn-api-confirm" class="btn btn-primary btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.5rem;">Confirm</button>
      <button id="btn-api-delete" class="btn btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.5rem; border-color: var(--danger-color); color: var(--danger-color);">Delete</button>
      <span id="api-status-dot" style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--border-color); margin-left: 0.5rem;"></span> 
      <span id="api-status-text">No Key</span>
    </div>
  </header>
  
  <div class="tabs" style="display: flex; gap: 1rem; border-bottom: 1px solid var(--border-color); padding-bottom: 0.5rem;">
    <button id="tab-record" class="tab-btn active">1. Recording</button>
    <button id="tab-analyze" class="tab-btn">2. AI Analysis</button>
    <button id="tab-export" class="tab-btn">3. Export</button>
  </div>

  <main id="main-content" style="display: flex; flex-direction: column; gap: 1.5rem; flex-grow: 1; margin-top: 1rem;">
  </main>
`

createIcons({
  icons: { Mic, FileText, Download, Users, Smartphone, Monitor }
});

const btnEnvToggle = document.getElementById('btn-env-toggle') as HTMLButtonElement;
const envIcon = document.getElementById('env-icon')!;
const envText = document.getElementById('env-text')!;

function updateGlobalEnvUI() {
  if (appState.isMobileMode) {
    envIcon.setAttribute('data-lucide', 'smartphone');
    envText.innerText = '모바일 환경';
  } else {
    envIcon.setAttribute('data-lucide', 'monitor');
    envText.innerText = 'PC 환경';
  }
  createIcons({
    icons: { Smartphone, Monitor },
    nameAttr: 'data-lucide',
    attrs: {
      class: 'lucide',
      'stroke-width': 2,
      stroke: 'currentColor',
      fill: 'none',
    }
  });
}

btnEnvToggle.addEventListener('click', () => {
  appState.isMobileMode = !appState.isMobileMode;
  updateGlobalEnvUI();
  window.dispatchEvent(new CustomEvent('envModeChanged'));
});

const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
const btnApiConfirm = document.getElementById('btn-api-confirm') as HTMLButtonElement;
const btnApiDelete = document.getElementById('btn-api-delete') as HTMLButtonElement;
const apiStatusDot = document.getElementById('api-status-dot') as HTMLSpanElement;
const apiStatusText = document.getElementById('api-status-text') as HTMLSpanElement;

function updateApiStatusUI(hasKey: boolean) {
  if (hasKey) {
    if (apiStatusDot) apiStatusDot.style.background = 'var(--success-color)';
    if (apiStatusText) apiStatusText.innerText = 'Key Set';
  } else {
    if (apiStatusDot) apiStatusDot.style.background = 'var(--border-color)';
    if (apiStatusText) apiStatusText.innerText = 'No Key';
  }
}

if (apiKeyInput && btnApiConfirm && btnApiDelete) {
  const savedKey = localStorage.getItem('openaiApiKey');
  if (savedKey) {
    apiKeyInput.value = savedKey;
    appState.openaiApiKey = savedKey;
    updateApiStatusUI(true);
  } else {
    updateApiStatusUI(false);
  }

  btnApiConfirm.addEventListener('click', () => {
    const val = apiKeyInput.value.trim();
    if (val) {
      appState.openaiApiKey = val;
      localStorage.setItem('openaiApiKey', val);
      updateApiStatusUI(true);
      alert('API Key saved successfully.');
    } else {
      alert('Please enter a valid API Key.');
    }
  });

  btnApiDelete.addEventListener('click', () => {
    apiKeyInput.value = '';
    appState.openaiApiKey = '';
    localStorage.removeItem('openaiApiKey');
    updateApiStatusUI(false);
    alert('API Key deleted successfully.');
  });
}

const mainContent = document.getElementById('main-content')!;

export function switchTab(tabId: 'record' | 'analyze' | 'export') {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tabId)?.classList.add('active');
  
  mainContent.innerHTML = '';
  
  if (tabId === 'record') renderRecordingView(mainContent);
  else if (tabId === 'analyze') renderAnalysisView(mainContent);
  else if (tabId === 'export') renderExportView(mainContent);
}

document.getElementById('tab-record')?.addEventListener('click', () => switchTab('record'));
document.getElementById('tab-analyze')?.addEventListener('click', () => switchTab('analyze'));
document.getElementById('tab-export')?.addEventListener('click', () => switchTab('export'));

// Listen for custom events to automatically switch tabs when user completes a step
window.addEventListener('recordingEnded', () => {
  switchTab('analyze');
});

window.addEventListener('analysisEnded', () => {
  switchTab('export');
});

switchTab('record');
