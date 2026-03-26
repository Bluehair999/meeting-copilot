import { createIcons, Download, FilePlus } from 'lucide';
import { appState } from './state';
import { Document, Packer, Paragraph, TextRun } from 'docx';
// @ts-ignore
import html2pdf from 'html2pdf.js';

async function saveBlobWithPicker(blob: Blob, defaultName: string, description: string, acceptExtensions: Record<string, string[]>) {
  try {
    if ('showSaveFilePicker' in window) {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: defaultName,
        types: [{ description, accept: acceptExtensions }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      alert('해당 폴더에 파일이 성공적으로 저장되었습니다!');
    } else {
      // Fallback for unsupported browsers (Mobile/Safari)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultName;
      a.click();
      URL.revokeObjectURL(url);
      alert('기본 다운로드 폴더에 저장되었습니다.');
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') alert('저장 중 오류 발생: ' + err.message);
  }
}

export function renderExportView(container: HTMLElement) {
  const participants = appState.participants;
  const colCount = participants.length <= 3 ? (participants.length === 0 ? 1 : participants.length) : 2;
  
  const signBoxes = participants.length === 0 
    ? `<div class="sign-box" style="border: 1px solid #000; padding: 1.5rem; text-align: center;"><strong>Manager</strong><br><br><br><span style="color: #666;">(인) / Signature</span></div>`
    : participants.map(p => `
        <div class="sign-box" style="border: 1px solid #000; padding: 1.5rem; text-align: center;">
          <strong>${p}</strong><br><br><br><span style="color: #666;">(인) / Signature</span>
        </div>
      `).join('');

  container.innerHTML = `
    <div class="card flex-col gap-2" style="animation: fadeIn 0.5s ease-out; flex-grow: 1;">
      <div class="card-header">
        <h2 style="display: flex; align-items: center; gap: 0.5rem;">
          <i data-lucide="file-plus"></i> Document Export
        </h2>
      </div>
      
      <p class="text-sm">2. AI Analysis 탭에서 최종 요약/변환된 텍스트를 기반으로 문서가 생성됩니다.</p>
      
      <div class="flex-col gap-1" style="background: var(--surface-color-light); padding: 1.5rem; border-radius: 8px; margin-top: 1rem;">
        <h3>Dynamic Sign-off Grid Preview</h3>
        <div class="text-sm" style="margin-bottom: 0.5rem;">결재/서명란 (참석자 개수 자동 반영)</div>
        <div id="export-sign-grid" style="display: grid; gap: 1rem; grid-template-columns: repeat(${colCount}, 1fr); margin-top: 0.5rem;">
          ${signBoxes}
        </div>
      </div>
      
      <div style="display: flex; gap: 1rem; margin-top: auto; padding-top: 2rem;">
        <button id="btn-export-pdf" class="btn btn-primary" style="flex: 1; padding: 1rem;">
          <i data-lucide="download"></i> Export PDF
        </button>
        <button id="btn-export-word" class="btn" style="flex: 1; padding: 1rem; background: #2b579a; color: white; border: none;">
          <i data-lucide="download"></i> Export Word (.docx)
        </button>
      </div>
    </div>
  `;

  createIcons({
    icons: { Download, FilePlus }
  });

  const btnPdf = document.getElementById('btn-export-pdf');
  const btnWord = document.getElementById('btn-export-word');

  btnWord?.addEventListener('click', async () => {
    if (!appState.analysisResult) {
      alert("출력할 AI 분석 결과가 없습니다. 2. AI Analysis 탭에서 분석을 먼저 진행해 주세요.");
      return;
    }
    
    // Convert plain text result to Word Paragraphs
    const lines = appState.analysisResult.split('\n');
    const docChildren = lines.map(line => new Paragraph({
      children: [new TextRun({ text: line, size: 24, font: "Malgun Gothic" })],
      spacing: { after: 120 }
    }));
    
    // Add signature space text
    docChildren.push(new Paragraph({
      children: [new TextRun({ text: "\n[ 결재 / 서명란 ]\n" + participants.join(" (인)   /   ") + (participants.length ? " (인)" : "담당자 (인)"), size: 24, font: "Malgun Gothic" })],
      spacing: { before: 400 }
    }));

    const doc = new Document({
      sections: [{ properties: {}, children: docChildren }]
    });

    try {
      btnWord.style.opacity = '0.5';
      const blob = await Packer.toBlob(doc);
      await saveBlobWithPicker(blob, 'Meeting_Minutes.docx', 'Word Document', { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] });
    } catch (e) {
      alert("Word 생성 실패!");
    } finally {
      btnWord.style.opacity = '1';
    }
  });

  btnPdf?.addEventListener('click', async () => {
    if (!appState.analysisResult) {
      alert("출력할 AI 분석 결과가 없습니다. 2. AI Analysis 탭에서 분석을 먼저 진행해 주세요.");
      return;
    }
    
    btnPdf.style.opacity = '0.5';
    try {
      // Create a hidden temporary clean HTML structure for PDF rendering
      const tempDiv = document.createElement('div');
      tempDiv.style.width = '800px';
      tempDiv.style.padding = '40px';
      tempDiv.style.background = '#FFFFFF';
      tempDiv.style.color = '#000000';
      tempDiv.style.fontFamily = 'sans-serif';
      
      const contentHtml = appState.analysisResult.replace(/\n/g, '<br>');
      
      tempDiv.innerHTML = `
        <h1 style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px;">Meeting Minutes</h1>
        <div style="line-height: 1.6; font-size: 14px; margin-bottom: 50px;">${contentHtml}</div>
        <div style="margin-top: 40px; border-top: 1px solid #ccc; padding-top: 20px;">
          <h3>Signatures</h3>
          <div style="display: flex; gap: 20px;">
            ${participants.length === 0 
              ? '<div style="border: 1px solid #000; padding: 20px; flex: 1; text-align: center;"><br><br><br>Manager (인)</div>'
              : participants.map(p => '<div style="border: 1px solid #000; padding: 20px; flex: 1; text-align: center;"><strong>' + p + '</strong><br><br><br>(인)</div>').join('')}
          </div>
        </div>
      `;
      document.body.appendChild(tempDiv);
      
      // Generate PDF Blob
      const opt = {
        margin: 10,
        filename: 'Meeting_Minutes.pdf',
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };
      
      const pdfBlob = await html2pdf().set(opt).from(tempDiv).output('blob');
      document.body.removeChild(tempDiv);
      
      await saveBlobWithPicker(pdfBlob, 'Meeting_Minutes.pdf', 'PDF Document', { 'application/pdf': ['.pdf'] });
    } catch (e) {
      alert("PDF 생성 실패!");
    } finally {
      btnPdf.style.opacity = '1';
    }
  });
}
