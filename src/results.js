import { state } from './state.js';

export function initResults() {
    const copyBtn = document.getElementById('copyBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const clearBtn = document.getElementById('clearBtn');
    const processBtn = document.getElementById('processBtn');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const previewContainer = document.getElementById('previewContainer');
    const pdfPreview = document.getElementById('pdfPreview');
    const resultText = document.getElementById('resultText');
    const statsContainer = document.getElementById('statsContainer');
    const actionButtons = document.getElementById('actionButtons');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');

    clearBtn.addEventListener('click', () => {
        state.currentFile = null;
        state.currentPdf = null;
        state.currentFileType = null;
        if (state.currentFileUrl) { URL.revokeObjectURL(state.currentFileUrl); state.currentFileUrl = null; }
        state.extractedText = '';
        state.embeddedText = '';
        state.comparisonResult = null;

        fileInput.value = '';
        fileInfo.classList.remove('active');
        previewContainer.style.display = 'none';

        // Clean up canvases before clearing
        const canvases = pdfPreview.querySelectorAll('canvas');
        canvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
        });
        pdfPreview.replaceChildren();

        processBtn.disabled = true;
        clearBtn.disabled = true;

        // Reset result text safely
        resultText.textContent = '';
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        emptyDiv.textContent = 'Upload a PDF and click "Start OCR Processing" to extract text';
        resultText.appendChild(emptyDiv);

        statsContainer.style.display = 'none';
        actionButtons.style.display = 'none';

        document.getElementById('verificationPanel').classList.remove('active');

        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
        progressFill.setAttribute('aria-valuenow', 0);
        progressText.textContent = 'Initializing...';
    });

    copyBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(state.extractedText);
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
        } catch (error) {
            alert('Failed to copy text to clipboard');
        }
    });

    downloadBtn.addEventListener('click', () => {
        let content = '';

        if (state.comparisonResult) {
            content += '=' .repeat(80) + '\n';
            content += 'VERIFICATION REPORT\n';
            content += '='.repeat(80) + '\n\n';
            content += `Overall Assessment: ${state.comparisonResult.overallAssessment}\n\n`;

            if (state.comparisonResult.hasEmbeddedText) {
                content += `Similarity Score: ${state.comparisonResult.similarity}%\n\n`;
            }
            content += `Semantic Integrity: ${state.comparisonResult.semanticIntegrity}\n\n`;

            if (state.comparisonResult.criticalErrors && state.comparisonResult.criticalErrors.length > 0) {
                content += 'CRITICAL ERRORS:\n';
                state.comparisonResult.criticalErrors.forEach(error => { content += `  - ${error}\n`; });
                content += '\n';
            }
            if (state.comparisonResult.structuralDifferences && state.comparisonResult.structuralDifferences.length > 0) {
                content += 'STRUCTURAL DIFFERENCES:\n';
                state.comparisonResult.structuralDifferences.forEach(diff => { content += `  - ${diff}\n`; });
                content += '\n';
            }
            if (state.comparisonResult.textAccuracyIssues && state.comparisonResult.textAccuracyIssues.length > 0) {
                content += 'TEXT ACCURACY ISSUES:\n';
                state.comparisonResult.textAccuracyIssues.forEach(issue => { content += `  - ${issue}\n`; });
                content += '\n';
            }

            content += '='.repeat(80) + '\n';
            content += 'EXTRACTED TEXT\n';
            content += '='.repeat(80) + '\n\n';
        }

        content += state.extractedText;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.currentFile.name.replace(/\.(pdf|docx)$/i, '')}_extracted.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
}
