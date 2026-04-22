import { createIcons, Plus, Download, Trash2, Globe, Languages, FileUp } from 'lucide';
import { appState } from './state';

export function renderGlossaryView(container: HTMLElement) {
    const langs = ['English', 'Polish', 'Spanish', 'Global'];
    let activeLang = 'English';

    function renderUI() {
        container.innerHTML = `
            <div class="card flex-col gap-2">
                <div class="card-header">
                    <h2 style="display: flex; align-items: center; gap: 0.5rem;">
                        <i data-lucide="globe" style="color: var(--primary-color);"></i> Terminology Glossary
                    </h2>
                    <div class="flex-row gap-1">
                        <label class="btn btn-sm" style="background: var(--surface-color-light); border-style: dashed;">
                            <i data-lucide="file-up"></i> Import CSV
                            <input type="file" id="glossary-import" accept=".csv" class="hidden">
                        </label>
                        <button id="btn-add-term" class="btn btn-primary btn-sm"><i data-lucide="plus"></i> Add Term</button>
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

        createIcons({ icons: { Plus, Download, Trash2, Globe, Languages, FileUp } });

        // Event Listeners for sub-tabs
        document.querySelectorAll('#glossary-lang-tabs .sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                activeLang = (e.currentTarget as HTMLElement).dataset.lang!;
                renderUI(); // Re-render to update active state and table
            });
        });

        document.getElementById('btn-add-term')?.addEventListener('click', addNewTermPrompt);
        document.getElementById('glossary-import')?.addEventListener('change', handleCsvImport);

        renderTerms();
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
