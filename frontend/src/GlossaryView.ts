import { createIcons, Plus, Download, Trash2, Globe, Languages, FileUp, Sparkles, Check, X } from 'lucide';
import { appState } from './state';

export function renderGlossaryView(container: HTMLElement) {
    const langs = ['English', 'Polish', 'Spanish', 'Global'];
    let activeLang = 'English';

    function renderUI() {
        container.innerHTML = `
            <div class="card flex-col gap-2">
                <div class="card-header">
                    <h2 style="display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="globe" style="color: var(--primary-color);"></i> Terminology AI Glossary
                    </h2>
                    <div class="flex-row gap-1" style="flex-wrap: wrap;">
                        <button id="btn-ai-extract" class="btn btn-sm" style="background: var(--primary-color); color: white; border-color: var(--primary-color); font-weight: bold;">
                            <i data-lucide="sparkles"></i> AI Extract (${appState.script.length})
                        </button>
                        <label class="btn btn-sm" style="background: var(--surface-color-light); border-style: dashed;">
                            <i data-lucide="file-up"></i> Import CSV
                            <input type="file" id="glossary-import" accept=".csv" class="hidden">
                        </label>
                        <button id="btn-add-term" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> Add Term</button>
                    </div>
                </div>

                <div id="ai-extract-modal" class="hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center;">
                    <div class="card" style="width: 90%; max-width: 800px; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
                        <div class="card-header">
                            <h3 style="display: flex; align-items: center; gap: 0.5rem;">
                                <i data-lucide="sparkles" style="color: var(--primary-color);"></i> AI Suggested Terms
                            </h3>
                            <button id="btn-close-modal" class="btn btn-sm"><i data-lucide="x"></i></button>
                        </div>
                        <p class="text-sm" style="margin-bottom: 1rem;">최근 대화 내용에서 추출된 용어입니다. 번역을 수정하거나 필요한 용어만 선택하여 추가하세요.</p>
                        
                        <div style="flex-grow: 1; overflow-y: auto; margin-bottom: 1rem; border: 1px solid var(--border-color); border-radius: 8px;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <thead style="position: sticky; top: 0; background: var(--surface-color); border-bottom: 2px solid var(--border-color); z-index: 1;">
                                    <tr style="text-align: left;">
                                        <th style="padding: 0.8rem; width: 40px;"><input type="checkbox" id="ai-select-all" checked></th>
                                        <th style="padding: 0.8rem;">Source (KR)</th>
                                        <th style="padding: 0.8rem;">Target (${activeLang})</th>
                                        <th style="padding: 0.8rem;">Category</th>
                                    </tr>
                                </thead>
                                <tbody id="ai-suggestions-tbody">
                                    <!-- AI Suggestions will appear here -->
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="flex-row gap-1" style="justify-content: flex-end;">
                            <button id="btn-cancel-extract" class="btn">Cancel</button>
                            <button id="btn-confirm-extract" class="btn btn-primary"><i data-lucide="check"></i> Add Selected to Glossary</button>
                        </div>
                    </div>
                </div>

                <div class="sub-tabs-container" id="glossary-lang-tabs" style="background: rgba(0,0,0,0.05);">
                    ${langs.map(l => `<button class="sub-tab-btn ${l === activeLang ? 'active' : ''}" data-lang="${l}">${l}</button>`).join('')}
                </div>

                <div id="glossary-table-container" style="margin-top: 1rem; overflow-x: auto;">
                    <table class="glossary-table" style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; border-bottom: 2px solid var(--border-color);">
                                <th style="padding: 0.8rem;">Source (KR/Original)</th>
                                <th style="padding: 0.8rem;">Target (Translation)</th>
                                <th style="padding: 0.8rem;">Category</th>
                                <th style="padding: 0.8rem; width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="glossary-tbody">
                            <!-- Terms will be rendered here -->
                        </tbody>
                    </table>
                    <div id="glossary-empty" class="hidden" style="text-align: center; padding: 3rem; color: var(--text-muted);">
                        등록된 용어가 없습니다. 'Add Term'을 눌러 용어를 추가하거나 CSV를 업로드하세요.
                    </div>
                </div>
            </div>
        `;

        createIcons({ icons: { Plus, Download, Trash2, Globe, Languages, FileUp, Sparkles, Check, X } });

        // Event Listeners for sub-tabs
        document.querySelectorAll('#glossary-lang-tabs .sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeLang = (e.currentTarget as HTMLElement).dataset.lang!;
                renderUI(); // Re-render to update active state and table
            });
        });

        document.getElementById('btn-add-term')?.addEventListener('click', addNewTermPrompt);
        document.getElementById('glossary-import')?.addEventListener('change', handleCsvImport);
        document.getElementById('btn-ai-extract')?.addEventListener('click', handleAiExtract);
        document.getElementById('btn-close-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-cancel-extract')?.addEventListener('click', closeModal);
        document.getElementById('btn-confirm-extract')?.addEventListener('click', confirmAiExtract);
        document.getElementById('ai-select-all')?.addEventListener('change', (e) => {
            const checked = (e.target as HTMLInputElement).checked;
            document.querySelectorAll('.ai-suggestion-checkbox').forEach(cb => (cb as HTMLInputElement).checked = checked);
        });

        renderTerms();
    }

    const modal = () => document.getElementById('ai-extract-modal')!;
    const closeModal = () => modal().classList.add('hidden');

    async function handleAiExtract() {
        if (!appState.openaiApiKey) {
            alert('API Key가 필요합니다. 상단에서 입력해 주세요.');
            return;
        }

        const script = appState.script || localStorage.getItem('meeting_script') || "";
        if (script.length < 50) {
            alert(`대화 내용이 부족합니다. (현재: ${script.length}자, 최소 50자 필요)\n회의를 진행하거나 통역기를 사용한 후 추출해 주세요.`);
            return;
        }

        // Sync local script to appState if it was in localStorage
        if (!appState.script && script) appState.script = script;

        const btn = document.getElementById('btn-ai-extract') as HTMLButtonElement;
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="sparkles" class="animate-spin"></i> Extracting...';
        btn.disabled = true;

        try {
            const backendHost = import.meta.env.VITE_BACKEND_URL || `${window.location.hostname}:8000`;
            const resp = await fetch(`${window.location.protocol}//${backendHost}/api/extract-terms`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: script,
                    target_lang: activeLang,
                    api_key: appState.openaiApiKey
                })
            });

            const data = await resp.json();
            if (data.error) {
                alert('추출 오류: ' + data.error);
                return;
            }

            renderAiSuggestions(data.terms);
            modal().classList.remove('hidden');
        } catch (e: any) {
            alert('연결 오류: ' + e.message);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            createIcons({ icons: { Sparkles, Check, X } });
        }
    }

    function renderAiSuggestions(terms: any[]) {
        const tbody = document.getElementById('ai-suggestions-tbody')!;
        tbody.innerHTML = terms.map((term, idx) => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem;"><input type="checkbox" class="ai-suggestion-checkbox" checked data-idx="${idx}"></td>
                <td style="padding: 0.5rem;"><input type="text" class="ai-edit-source" value="${term.source}" style="width: 100%; padding: 0.3rem;"></td>
                <td style="padding: 0.5rem;"><input type="text" class="ai-edit-target" value="${term.target}" style="width: 100%; padding: 0.3rem;"></td>
                <td style="padding: 0.5rem;"><input type="text" class="ai-edit-category" value="${term.category || 'AI'}" style="width: 100%; padding: 0.3rem;"></td>
            </tr>
        `).join('');
    }

    function confirmAiExtract() {
        const rows = document.querySelectorAll('#ai-suggestions-tbody tr');
        let addedCount = 0;

        rows.forEach(row => {
            const cb = row.querySelector('.ai-suggestion-checkbox') as HTMLInputElement;
            if (cb.checked) {
                const source = (row.querySelector('.ai-edit-source') as HTMLInputElement).value;
                const target = (row.querySelector('.ai-edit-target') as HTMLInputElement).value;
                const category = (row.querySelector('.ai-edit-category') as HTMLInputElement).value;

                if (source && target) {
                    if (!appState.glossary[activeLang]) appState.glossary[activeLang] = [];
                    appState.glossary[activeLang].push({
                        id: Date.now().toString() + Math.random(),
                        source,
                        target,
                        category
                    });
                    addedCount++;
                }
            }
        });

        if (addedCount > 0) {
            saveGlossary();
            renderTerms();
            closeModal();
            alert(`${addedCount}개의 용어가 추가되었습니다.`);
        } else {
            alert('선택된 용어가 없습니다.');
        }
    }

    function renderTerms() {
        const tbody = document.getElementById('glossary-tbody')!;
        const empty = document.getElementById('glossary-empty')!;
        const terms = appState.glossary[activeLang] || [];

        if (terms.length === 0) {
            tbody.innerHTML = '';
            empty.classList.remove('hidden');
            return;
        }

        empty.classList.add('hidden');
        tbody.innerHTML = terms.map(term => `
            <tr style="border-bottom: 1px solid var(--border-color);">
                <td style="padding: 0.8rem;">${term.source}</td>
                <td style="padding: 0.8rem;">${term.target}</td>
                <td style="padding: 0.8rem;"><span class="tag" style="background: rgba(0,0,0,0.05); color: var(--text-main);">${term.category || 'General'}</span></td>
                <td style="padding: 0.8rem;">
                    <button class="btn-delete-row" style="background: none; border: none; color: var(--danger-color); cursor: pointer;" data-id="${term.id}">
                        <i data-lucide="trash-2" style="width: 16px;"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        createIcons({ icons: { Trash2 } });

        document.querySelectorAll('.btn-delete-row').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = (e.currentTarget as HTMLElement).dataset.id;
                deleteTerm(id!);
            });
        });
    }

    function addNewTermPrompt() {
        const source = prompt('Source word (KR or Original):');
        if (!source) return;
        const target = prompt('Target word (Translation):');
        if (!target) return;
        const category = prompt('Category (Optional):') || 'General';

        const newTerm = {
            id: Date.now().toString(),
            source,
            target,
            category
        };

        if (!appState.glossary[activeLang]) appState.glossary[activeLang] = [];
        appState.glossary[activeLang].push(newTerm);
        saveGlossary();
        renderTerms();
    }

    function deleteTerm(id: string) {
        if (confirm('용어를 삭제하시겠습니까?')) {
            appState.glossary[activeLang] = appState.glossary[activeLang].filter(t => t.id !== id);
            saveGlossary();
            renderTerms();
        }
    }

    function handleCsvImport(e: Event) {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const csv = event.target?.result as string;
            const lines = csv.split('\n');
            const newTerms: any[] = [];
            
            // Basic CSV parser (assuming: Source, Target, Category)
            lines.forEach((line, index) => {
                if (index === 0 && line.toLowerCase().includes('source')) return; // Skip header
                const parts = line.split(',').map(p => p.trim());
                if (parts.length >= 2 && parts[0] && parts[1]) {
                    newTerms.push({
                        id: (Date.now() + index).toString(),
                        source: parts[0],
                        target: parts[1],
                        category: parts[2] || 'Imported'
                    });
                }
            });

            if (newTerms.length > 0) {
                if (!appState.glossary[activeLang]) appState.glossary[activeLang] = [];
                appState.glossary[activeLang] = [...appState.glossary[activeLang], ...newTerms];
                saveGlossary();
                renderTerms();
                alert(`${newTerms.length}개의 용어를 불러왔습니다.`);
            } else {
                alert('유효한 용어를 찾지 못했습니다. CSV 형식을 확인해 주세요. (예: 원문,번역문,범주)');
            }
        };
        reader.readAsText(file);
    }

    function saveGlossary() {
        localStorage.setItem('glossary_data', JSON.stringify(appState.glossary));
    }

    // Load from localStorage on first render
    const saved = localStorage.getItem('glossary_data');
    if (saved && Object.keys(appState.glossary).length === 0) {
        try {
            appState.glossary = JSON.parse(saved);
        } catch(e) {}
    }

    renderUI();
}
