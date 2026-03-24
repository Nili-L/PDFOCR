import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
import { CONFIG } from './config.js';
import { state } from './state.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export { pdfjsLib };

export async function loadPdfPreview(file) {
    const pdfPreview = document.getElementById('pdfPreview');
    const previewContainer = document.getElementById('previewContainer');

    try {
        if (state.currentFileUrl) URL.revokeObjectURL(state.currentFileUrl);
        state.currentFileUrl = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(state.currentFileUrl);
        state.currentPdf = await loadingTask.promise;

        // Clear previous canvases properly
        const oldCanvases = pdfPreview.querySelectorAll('canvas');
        oldCanvases.forEach(canvas => {
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
        });
        pdfPreview.replaceChildren();

        const numPages = Math.min(state.currentPdf.numPages, CONFIG.MAX_PREVIEW_PAGES);

        for (let i = 1; i <= numPages; i++) {
            const page = await state.currentPdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });

            const canvas = document.createElement('canvas');
            canvas.setAttribute('role', 'img');
            canvas.setAttribute('aria-label', `Preview of page ${i}`);
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: context, viewport }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';

            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-number';
            pageLabel.textContent = `Page ${i}`;

            pageDiv.appendChild(pageLabel);
            pageDiv.appendChild(canvas);
            pdfPreview.appendChild(pageDiv);
        }

        if (state.currentPdf.numPages > CONFIG.MAX_PREVIEW_PAGES) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'pdf-page';
            moreDiv.style.display = 'flex';
            moreDiv.style.alignItems = 'center';
            moreDiv.style.justifyContent = 'center';
            moreDiv.style.background = '#e9ecef';
            const moreText = document.createElement('p');
            moreText.style.textAlign = 'center';
            moreText.style.color = '#6c757d';
            moreText.textContent = `+${state.currentPdf.numPages - CONFIG.MAX_PREVIEW_PAGES} more pages`;
            moreDiv.appendChild(moreText);
            pdfPreview.appendChild(moreDiv);
        }

        previewContainer.style.display = 'block';

    } catch (error) {
        console.error('Error loading PDF preview:', error);
        alert('Error loading PDF preview');
    }
}
