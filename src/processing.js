import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { CONFIG } from './config.js';

export async function extractTextFromDocx(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error('Error extracting DOCX text:', error);
        throw new Error('Failed to extract text from DOCX file');
    }
}

export function isTextReadable(text) {
    const cleanText = text.replace(/[\s\-_]+/g, '');
    const hebrewChars = (cleanText.match(/[\u0590-\u05FF]/g) || []).length;
    const latinChars = (cleanText.match(/[a-zA-Z]/g) || []).length;
    const numbers = (cleanText.match(/[0-9]/g) || []).length;
    const recognizable = hebrewChars + latinChars + numbers;

    if (cleanText.length > 0 && recognizable / cleanText.length < 0.5) {
        return false;
    }
    return true;
}

export async function extractEmbeddedText(pdf) {
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        const pageText = textContent.items
            .map(item => item.str)
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();

        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
    }

    return fullText.trim();
}

export async function extractTextFromPdf(pdf) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const statusRegion = document.getElementById('statusAnnouncer');

    const worker = await createWorker(['heb', 'eng'], 1, {
        logger: () => {}
    });

    await worker.setParameters({
        tessedit_pageseg_mode: '4',
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
    });

    let fullText = '';

    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            const progress = Math.round((i / pdf.numPages) * 50 + 50);
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${progress}%`;
            progressFill.setAttribute('aria-valuenow', progress);
            const msg = `OCR processing page ${i} of ${pdf.numPages}...`;
            progressText.textContent = msg;
            if (statusRegion) statusRegion.textContent = `${progress}% - ${msg}`;

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: CONFIG.PDF_RENDER_SCALE });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport,
                intent: 'print'
            }).promise;

            const { data: { text } } = await worker.recognize(canvas, {
                rotateAuto: true,
            });

            // Clean up canvas after OCR
            context.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;

            fullText += `\n--- Page ${i} ---\n${text}\n`;
        }

        await worker.terminate();
        return fullText.trim();

    } catch (error) {
        await worker.terminate();
        throw error;
    }
}

export function createComparisonResult(hasEmbeddedText, similarity, message) {
    return {
        hasEmbeddedText,
        similarity,
        criticalErrors: [],
        structuralDifferences: [],
        textAccuracyIssues: [],
        semanticIntegrity: message,
        overallAssessment: message
    };
}
