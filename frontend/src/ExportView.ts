import { createIcons, Download, FilePlus } from 'lucide';
import { appState } from './state';
import { 
  Document, Packer, Paragraph, TextRun, 
  Table, TableRow, TableCell, BorderStyle, 
  AlignmentType, WidthType, HeadingLevel, VerticalAlign 
} from 'docx';
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
    
    const lines = appState.analysisResult.split('\n');
    const docChildren: any[] = [];
    let tableBuffer: string[] = [];

    function flushTable() {
      if (tableBuffer.length < 2) {
        tableBuffer = [];
        return;
      }
      
      const rows = tableBuffer.filter(line => line.includes('|') && !line.includes('|-'));
      if (rows.length === 0) {
        tableBuffer = [];
        return;
      }

      const tableRows = rows.map((line, rowIndex) => {
        const cells = line.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1);
        return new TableRow({
          children: cells.map(cell => new TableCell({
            children: [new Paragraph({
              children: [new TextRun({ 
                text: cell.trim(), 
                bold: rowIndex === 0,
                color: rowIndex === 0 ? "FFFFFF" : "000000",
                size: 20, 
                font: "Arial" 
              })],
              alignment: AlignmentType.LEFT
            })],
            shading: rowIndex === 0 ? { fill: "4B5563" } : undefined,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
          }))
        });
      });

      docChildren.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 2, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        }
      }));
      docChildren.push(new Paragraph({ text: "", spacing: { after: 200 } })); // Spacer
      tableBuffer = [];
    }

    lines.forEach((line) => {
      const trimmed = line.trim();
      
      // Table handling
      if (trimmed.startsWith('|')) {
        tableBuffer.push(trimmed);
        return;
      } else if (tableBuffer.length > 0) {
        flushTable();
      }

      if (trimmed.startsWith('# ')) {
        docChildren.push(new Paragraph({
          text: trimmed.replace('# ', '').toUpperCase(),
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 200 },
          border: { bottom: { color: "1E3A8A", space: 1, style: BorderStyle.SINGLE, size: 6 } }
        }));
      } else if (trimmed.startsWith('## ')) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: trimmed.replace('## ', ''), bold: true, color: "000000", size: 22 })],
          shading: { fill: "E5E7EB" },
          alignment: AlignmentType.LEFT,
          spacing: { before: 300, after: 100 },
          indent: { left: 0 },
          border: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "000000" }
          }
        }));
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: trimmed.substring(2), size: 20, font: "Malgun Gothic" })],
          bullet: { level: 0 },
          spacing: { after: 100 }
        }));
      } else if (trimmed === '---') {
        docChildren.push(new Paragraph({
          border: { bottom: { color: "000000", space: 1, style: BorderStyle.SINGLE, size: 12 } },
          spacing: { before: 200, after: 200 }
        }));
      } else if (trimmed) {
        docChildren.push(new Paragraph({
          children: [new TextRun({ text: trimmed, size: 20, font: "Malgun Gothic" })],
          spacing: { after: 120 }
        }));
      }
    });
    
    // Final check for table
    if (tableBuffer.length > 0) flushTable();
    
    // Add signature space text (Styled Table for signatures)
    docChildren.push(new Paragraph({ 
      children: [new TextRun({ text: "\n[ 결재 / 서명란 ]", bold: true })],
      spacing: { before: 400, after: 200 } 
    }));
    
    const signRow = new TableRow({
      children: participants.length === 0 
        ? [new TableCell({ 
            children: [new Paragraph({ children: [new TextRun({ text: "Manager", bold: true })], alignment: AlignmentType.CENTER })], 
            verticalAlign: VerticalAlign.CENTER, 
            margins: { top: 400, bottom: 400 }, 
            shading: { fill: "F3F4F6" } 
          })]
        : participants.map(p => new TableCell({
            children: [
              new Paragraph({ children: [new TextRun({ text: p, bold: true })], alignment: AlignmentType.CENTER }), 
              new Paragraph({ children: [new TextRun({ text: "\n\n(인) Signature", size: 16 })], alignment: AlignmentType.CENTER })
            ],
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 200, bottom: 200 }
          }))
    });
    
    docChildren.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [signRow]
    }));

    const doc = new Document({
      sections: [{ properties: {}, children: docChildren }]
    });

    try {
      btnWord!.style.opacity = '0.5';
      const blob = await Packer.toBlob(doc);
      await saveBlobWithPicker(blob, 'Meeting_Minutes.docx', 'Word Document', { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] });
    } catch (e) {
      console.error(e);
      alert("Word 생성 실패!");
    } finally {
      btnWord!.style.opacity = '1';
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
      
      const contentHtml = (window as any).marked ? (window as any).marked.parse(appState.analysisResult) : appState.analysisResult.replace(/\n/g, '<br>');
      
      const customStyles = `
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
          body { font-family: 'Inter', sans-serif; }
          .pdf-container { padding: 40px; color: #111; }
          h1 { font-size: 24px; text-align: center; color: #1e3a8a; border-bottom: 3px solid #1e3a8a; padding-bottom: 10px; margin-bottom: 30px; text-transform: uppercase; }
          h2 { font-size: 16px; background-color: #f3f4f6; border: 1px solid #000; padding: 8px 12px; margin-top: 25px; margin-bottom: 10px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #000; padding: 10px; text-align: left; font-size: 13px; }
          th { background-color: #4b5563; color: white; font-weight: bold; }
          tr:nth-child(even) { background-color: #f9fafb; }
          ul { padding-left: 20px; margin-bottom: 15px; }
          li { margin-bottom: 5px; font-size: 14px; }
          .signature-area { margin-top: 50px; }
          .signature-title { font-weight: bold; font-size: 16px; margin-bottom: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .signature-grid { display: flex; gap: 15px; }
          .signature-box { border: 1px solid #000; padding: 20px; flex: 1; text-align: center; min-height: 100px; }
          .signature-label { margin-top: 40px; font-size: 12px; color: #666; }
        </style>
      `;

      tempDiv.innerHTML = `
        ${customStyles}
        <div class="pdf-container">
          <h1>Minutes of Meeting</h1>
          <div class="content">${contentHtml}</div>
          <div class="signature-area">
            <div class="signature-title">[ 결재 / 서명란 ]</div>
            <div class="signature-grid">
              ${participants.length === 0 
                ? '<div class="signature-box"><strong>Manager</strong><div class="signature-label">(인) / Signature</div></div>'
                : participants.map(p => '<div class="signature-box"><strong>' + p + '</strong><div class="signature-label">(인) / Signature</div></div>').join('')}
            </div>
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
