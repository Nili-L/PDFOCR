import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';
import { openDB, writePage, readPages, readAllPages, writeMeta, readMeta, clearAll } from './db.js';

// Configure PDF.js worker — bundled locally, no external CDN
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.js?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const previewContainer = document.getElementById('previewContainer');
const pdfPreview = document.getElementById('pdfPreview');
const resultText = document.getElementById('resultText');
const statsContainer = document.getElementById('statsContainer');
const charCount = document.getElementById('charCount');
const wordCount = document.getElementById('wordCount');
const pageCount = document.getElementById('pageCount');
const actionButtons = document.getElementById('actionButtons');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Config
const CONFIG = {
    MAX_PREVIEW_PAGES: 5,
    PDF_RENDER_SCALE: 3.0,
};

function updateProgress(percentage, message) {
    progressFill.style.width = `${percentage}%`;
    progressFill.textContent = `${percentage}%`;
    progressText.textContent = message;
}


function createExtractionSummary(method, message) {
    return { method, message };
}

// State
let currentFile = null;
let currentPdf = null;
let currentFileType = null; // 'pdf' or 'docx'
let currentFileUrl = null;
let extractionSummary = null;
let totalChars = 0;
let totalWords = 0;
let processedPages = 0;

// Upload Area Events
uploadArea.addEventListener('click', () => fileInput.click());
uploadArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', (e) => {
    if (!uploadArea.contains(e.relatedTarget)) {
        uploadArea.classList.remove('dragover');
    }
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        const validTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (validTypes.includes(file.type)) {
            handleFileSelect(file);
        } else {
            alert('Please upload a valid PDF or DOCX file');
        }
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle File Selection
async function handleFileSelect(file) {
    // Determine file type
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        currentFileType = 'pdf';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        currentFileType = 'docx';
    } else {
        alert('Please upload a valid PDF or DOCX file');
        return;
    }

    currentFile = file;

    // Display file info
    fileName.textContent = file.name;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    fileInfo.classList.add('active');

    // Enable buttons
    processBtn.disabled = false;
    clearBtn.disabled = false;

    // Load and preview based on file type
    if (currentFileType === 'pdf') {
        await loadPdfPreview(file);
    } else {
        // Hide preview for DOCX files
        previewContainer.style.display = 'none';
    }
}

// Load PDF Preview
async function loadPdfPreview(file) {
    try {
        if (currentFileUrl) URL.revokeObjectURL(currentFileUrl);
        currentFileUrl = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(currentFileUrl);
        currentPdf = await loadingTask.promise;

        // Clear previous preview
        pdfPreview.innerHTML = '';

        // Show only first 5 pages for preview
        const numPages = Math.min(currentPdf.numPages, CONFIG.MAX_PREVIEW_PAGES);

        for (let i = 1; i <= numPages; i++) {
            const page = await currentPdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.5 });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            const pageDiv = document.createElement('div');
            pageDiv.className = 'pdf-page';

            const pageLabel = document.createElement('div');
            pageLabel.className = 'page-number';
            pageLabel.textContent = `Page ${i}`;

            pageDiv.appendChild(pageLabel);
            pageDiv.appendChild(canvas);
            pdfPreview.appendChild(pageDiv);
        }

        if (currentPdf.numPages > CONFIG.MAX_PREVIEW_PAGES) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'pdf-page';
            moreDiv.style.display = 'flex';
            moreDiv.style.alignItems = 'center';
            moreDiv.style.justifyContent = 'center';
            moreDiv.style.background = '#e9ecef';
            moreDiv.innerHTML = `<p style="text-align: center; color: #6c757d;">+${currentPdf.numPages - CONFIG.MAX_PREVIEW_PAGES} more pages</p>`;
            pdfPreview.appendChild(moreDiv);
        }

        previewContainer.style.display = 'block';

    } catch (error) {
        console.error('Error loading PDF:', error);
        if (error.message && (error.message.includes('memory') || error.message.includes('allocation') || error.name === 'RangeError')) {
            alert('This file is too large for your browser to handle. Try closing other tabs or using a smaller file.');
        } else {
            alert('Error loading PDF: ' + error.message);
        }
        currentFile = null;
        currentPdf = null;
        currentFileType = null;
        if (currentFileUrl) { URL.revokeObjectURL(currentFileUrl); currentFileUrl = null; }
        fileInfo.classList.remove('active');
        processBtn.disabled = true;
    }
}

// Process Document (PDF or DOCX)
function updateIncrementalStats(pageText, currentPage) {
    const chars = pageText.length;
    const words = pageText.trim().split(/\s+/).filter(w => w.length > 0).length;
    totalChars += chars;
    totalWords += words;
    processedPages = currentPage;

    charCount.textContent = totalChars.toLocaleString();
    wordCount.textContent = totalWords.toLocaleString();
    pageCount.textContent = processedPages;
    statsContainer.style.display = 'flex';
}

const DISPLAY_PAGE_LIMIT = 20;
let displayedPages = 0;

function appendPageToDisplay(pageNumber, text, force = false) {
    if (!force && displayedPages >= DISPLAY_PAGE_LIMIT) return;

    // Remove empty state placeholder on first page
    if (displayedPages === 0) {
        resultText.textContent = '';
    }

    const pageDiv = document.createElement('div');
    pageDiv.style.marginBottom = '16px';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 600; color: #667eea; margin-bottom: 4px; font-size: 0.85rem;';
    header.textContent = 'Page ' + pageNumber;

    const content = document.createElement('div');
    content.style.cssText = 'white-space: pre-wrap; word-wrap: break-word;';
    content.textContent = text;

    pageDiv.appendChild(header);
    pageDiv.appendChild(content);
    resultText.appendChild(pageDiv);
    displayedPages++;
}

async function assembleFullText() {
    const pages = await readAllPages();
    return pages
        .filter(p => p.method !== 'error')
        .map(p => '\n--- Page ' + p.pageNumber + ' ---\n' + p.text)
        .join('\n')
        .trim();
}

function showLoadMoreButton() {
    const container = document.getElementById('loadMoreContainer');
    container.style.display = 'block';

    const btn = document.getElementById('loadMoreBtn');
    btn.textContent = 'Load more pages (showing ' + displayedPages + ' of ' + processedPages + ')';
}

document.getElementById('loadMoreBtn').addEventListener('click', async () => {
    const nextStart = displayedPages + 1;
    const pages = await readPages(nextStart, DISPLAY_PAGE_LIMIT);

    for (const page of pages) {
        if (page.method === 'error') {
            appendPageToDisplay(page.pageNumber, '[Error: ' + page.error + ']', true);
        } else {
            appendPageToDisplay(page.pageNumber, page.text, true);
        }
    }

    if (displayedPages >= processedPages) {
        document.getElementById('loadMoreContainer').style.display = 'none';
    } else {
        const btn = document.getElementById('loadMoreBtn');
        btn.textContent = 'Load more pages (showing ' + displayedPages + ' of ' + processedPages + ')';
    }
});

processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    processBtn.disabled = true;
    clearBtn.disabled = true;
    progressContainer.classList.add('active');

    // Reset state for new extraction
    totalChars = 0;
    totalWords = 0;
    processedPages = 0;
    displayedPages = 0;
    resultText.textContent = '';
    await clearAll();

    try {
        if (currentFileType === 'docx') {
            updateProgress(50, 'Extracting text from DOCX...');

            const docxText = await extractTextFromDocx(currentFile);

            await writePage(1, docxText, 'embedded');
            updateIncrementalStats(docxText, 1);
            appendPageToDisplay(1, docxText);

            await writeMeta({
                fileName: currentFile.name,
                totalPages: 1,
                completedPages: 1,
                startedAt: new Date().toISOString(),
                status: 'completed',
            });

            updateProgress(100, 'Complete!');

            extractionSummary = createExtractionSummary(
                'embedded', 'Text extracted directly from document'
            );

        } else {
            if (!currentPdf) throw new Error('PDF failed to load. Please try re-uploading the file.');

            const forceOcr = document.getElementById('forceOcrCheckbox').checked;

            let hasGoodEmbeddedText = false;
            if (!forceOcr) {
                updateProgress(30, 'Extracting embedded text...');
                const embeddedText = await extractEmbeddedText(currentPdf);

                hasGoodEmbeddedText = embeddedText &&
                                      embeddedText.trim().length > 100 &&
                                      isTextReadable(embeddedText);
            }

            if (hasGoodEmbeddedText) {
                updateProgress(100, 'Using embedded text (100% accuracy)...');

                extractionSummary = createExtractionSummary(
                    'embedded', 'Text extracted directly from PDF'
                );
            } else {
                // Embedded text was garbled — redo with OCR
                totalChars = 0;
                totalWords = 0;
                processedPages = 0;
                displayedPages = 0;
                resultText.textContent = '';
                await clearAll();

                // Write meta immediately so a crash before the first OCR page
                // still leaves a recoverable in_progress record.
                await writeMeta({
                    fileName: currentFile.name,
                    totalPages: currentPdf.numPages,
                    completedPages: 0,
                    startedAt: new Date().toISOString(),
                    status: 'in_progress',
                });

                updateProgress(50, forceOcr ? 'Performing OCR...' : 'Embedded text is garbled - performing OCR...');
                await extractTextFromPdf(currentPdf);

                updateProgress(100, 'OCR complete');

                extractionSummary = createExtractionSummary(
                    'ocr', forceOcr
                        ? 'OCR extraction complete (forced by user)'
                        : 'OCR extraction complete - embedded text was garbled/unreadable'
                );
            }

            await writeMeta({
                fileName: currentFile.name,
                totalPages: currentPdf.numPages,
                completedPages: currentPdf.numPages,
                startedAt: new Date().toISOString(),
                status: 'completed',
            });
        }

        actionButtons.style.display = 'flex';
        displayExtractionSummary(extractionSummary);

        if (processedPages > DISPLAY_PAGE_LIMIT) {
            showLoadMoreButton();
        }

    } catch (error) {
        console.error('Error processing document:', error);
        alert('Error processing document: ' + error.message);
        resultText.textContent = 'Error processing document. Please try again.';
    } finally {
        progressContainer.classList.remove('active');
        processBtn.disabled = false;
        clearBtn.disabled = false;
    }
});

// Extract text from DOCX
async function extractTextFromDocx(file) {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    } catch (error) {
        console.error('Error extracting DOCX text:', error);
        throw new Error('Failed to extract text from DOCX file');
    }
}

// Check if extracted text is readable (not garbled/gibberish)
function isTextReadable(text) {
    // Remove whitespace and common separators
    const cleanText = text.replace(/[\s\-_]+/g, '');

    // Count Hebrew characters
    const hebrewChars = (cleanText.match(/[\u0590-\u05FF]/g) || []).length;

    // Count Latin characters
    const latinChars = (cleanText.match(/[a-zA-Z]/g) || []).length;

    // Count numbers
    const numbers = (cleanText.match(/[0-9]/g) || []).length;

    // Total recognizable characters
    const recognizable = hebrewChars + latinChars + numbers;

    // If less than 50% of non-whitespace characters are recognizable, it's likely garbled
    if (cleanText.length > 0 && recognizable / cleanText.length < 0.5) {
        return false;
    }

    return true;
}

// Extract embedded text from PDF while preserving formatting
async function extractEmbeddedText(pdf) {
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

        await writePage(i, pageText, 'embedded');
        updateIncrementalStats(pageText, i);
        appendPageToDisplay(i, pageText);

        await writeMeta({
            fileName: currentFile.name,
            totalPages: pdf.numPages,
            completedPages: i,
            startedAt: new Date().toISOString(),
            status: 'in_progress',
        });
    }

    return fullText.trim();
}


// Extract Text from PDF via OCR
async function extractTextFromPdf(pdf) {
    let worker = await createWorker(['heb', 'eng'], 1, {
        logger: () => {}
    });

    await worker.setParameters({
        tessedit_pageseg_mode: '4',
        tessedit_ocr_engine_mode: '1',
        preserve_interword_spaces: '1',
    });

    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            const progress = Math.round((i / pdf.numPages) * 50 + 50);
            updateProgress(progress, `OCR processing page ${i} of ${pdf.numPages}...`);

            try {
                const page = await pdf.getPage(i);
                const viewport = page.getViewport({ scale: CONFIG.PDF_RENDER_SCALE });

                let canvas = document.createElement('canvas');
                let context = canvas.getContext('2d');
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

                canvas.width = 0;
                canvas.height = 0;
                canvas = null;
                context = null;

                await writePage(i, text, 'ocr');
                updateIncrementalStats(text, i);
                appendPageToDisplay(i, text);

            } catch (pageError) {
                try {
                    await worker.terminate();
                    worker = await createWorker(['heb', 'eng'], 1, { logger: () => {} });
                    await worker.setParameters({
                        tessedit_pageseg_mode: '4',
                        tessedit_ocr_engine_mode: '1',
                        preserve_interword_spaces: '1',
                    });

                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: CONFIG.PDF_RENDER_SCALE });
                    let canvas = document.createElement('canvas');
                    let context = canvas.getContext('2d');
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

                    canvas.width = 0;
                    canvas.height = 0;
                    canvas = null;
                    context = null;

                    await writePage(i, text, 'ocr');
                    updateIncrementalStats(text, i);
                    appendPageToDisplay(i, text);

                } catch (retryError) {
                    console.error(`Page ${i} failed after retry:`, retryError);
                    await writePage(i, '', 'error', retryError.message);
                    appendPageToDisplay(i, '[Error: ' + retryError.message + ']');
                }
            }

            await writeMeta({
                fileName: currentFile.name,
                totalPages: pdf.numPages,
                completedPages: i,
                startedAt: new Date().toISOString(),
                status: 'in_progress',
            });
        }

        await worker.terminate();

    } catch (error) {
        await worker.terminate();
        throw error;
    }
}

// Display extraction summary in UI
function displayExtractionSummary(summary) {
    const panel = document.getElementById('verificationPanel');
    const badge = document.getElementById('verificationBadge');
    const overallAssessment = document.getElementById('overallAssessment');

    // Hide the similarity bar and detail sections — no real comparison is performed
    document.getElementById('similarityFill').parentElement.parentElement.style.display = 'none';
    document.getElementById('criticalErrorsSection').style.display = 'none';
    document.getElementById('structuralDifferencesSection').style.display = 'none';
    document.getElementById('textAccuracySection').style.display = 'none';
    document.getElementById('semanticIntegrity').parentElement.style.display = 'none';

    badge.className = 'verification-badge ' + (summary.method === 'embedded' ? 'badge-excellent' : 'badge-good');
    badge.textContent = summary.method === 'embedded' ? 'Direct extraction' : 'OCR';

    overallAssessment.textContent = summary.message;
    overallAssessment.parentElement.style.display = 'block';

    panel.classList.add('active');
}

// Clear/Reset
clearBtn.addEventListener('click', async () => {
    currentFile = null;
    currentPdf = null;
    currentFileType = null;
    if (currentFileUrl) { URL.revokeObjectURL(currentFileUrl); currentFileUrl = null; }
    extractionSummary = null;
    totalChars = 0;
    totalWords = 0;
    processedPages = 0;
    displayedPages = 0;

    await clearAll();

    fileInput.value = '';
    fileInfo.classList.remove('active');
    previewContainer.style.display = 'none';
    pdfPreview.textContent = '';

    processBtn.disabled = true;
    clearBtn.disabled = true;

    const emptyState = document.createElement('div');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'Upload a PDF and click "Start OCR Processing" to extract text';
    resultText.textContent = '';
    resultText.appendChild(emptyState);

    statsContainer.style.display = 'none';
    actionButtons.style.display = 'none';
    document.getElementById('loadMoreContainer').style.display = 'none';
    document.getElementById('verificationPanel').classList.remove('active');

    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
    progressText.textContent = 'Initializing...';
});

// Copy to Clipboard
copyBtn.addEventListener('click', async () => {
    try {
        const fullText = await assembleFullText();
        await navigator.clipboard.writeText(fullText);

        const originalText = copyBtn.textContent;
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = originalText; }, 2000);
    } catch (error) {
        alert('Failed to copy text to clipboard');
    }
});

// Download as TXT with verification report
downloadBtn.addEventListener('click', async () => {
    const fullText = await assembleFullText();
    const pages = await readAllPages();
    let content = '';

    content += '='.repeat(80) + '\n';
    content += 'EXTRACTION REPORT\n';
    content += '='.repeat(80) + '\n\n';

    if (extractionSummary) {
        content += 'Method: ' + extractionSummary.method + '\n';
        content += 'Summary: ' + extractionSummary.message + '\n\n';
    }

    const failedPages = pages.filter(function(p) { return p.method === 'error'; });
    if (failedPages.length > 0) {
        content += 'FAILED PAGES:\n';
        failedPages.forEach(function(p) { content += '  - Page ' + p.pageNumber + ': ' + p.error + '\n'; });
        content += '\n';
    }

    content += '='.repeat(80) + '\n';
    content += 'EXTRACTED TEXT\n';
    content += '='.repeat(80) + '\n\n';

    content += fullText;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFile.name.replace(/\.(pdf|docx)$/i, '') + '_extracted.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

// Helper Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Check for interrupted extraction on page load
(async function checkRecovery() {
    try {
        const meta = await readMeta();
        if (!meta || meta.status !== 'in_progress') return;

        const banner = document.getElementById('recoveryBanner');
        const info = document.getElementById('recoveryInfo');
        info.textContent = ' ' + meta.completedPages + ' of ' + meta.totalPages + ' pages were saved from "' + meta.fileName + '".';
        banner.style.display = 'block';

        document.getElementById('recoveryDownloadBtn').addEventListener('click', async () => {
            const fullText = await assembleFullText();
            const blob = new Blob([fullText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = meta.fileName.replace(/\.(pdf|docx)$/i, '') + '_partial.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            await clearAll();
            banner.style.display = 'none';
        });

        document.getElementById('recoveryDismissBtn').addEventListener('click', async () => {
            await clearAll();
            banner.style.display = 'none';
        });
    } catch (error) {
        console.error('Recovery check failed:', error);
    }
})();
