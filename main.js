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
    SIMILARITY_THRESHOLDS: { EXCELLENT: 95, GOOD: 85, FAIR: 70 }
};

function updateProgress(percentage, message) {
    progressFill.style.width = `${percentage}%`;
    progressFill.textContent = `${percentage}%`;
    progressText.textContent = message;
}

function updateStatistics(text, pages) {
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    charCount.textContent = chars.toLocaleString();
    wordCount.textContent = words.toLocaleString();
    pageCount.textContent = pages || '-';
}

function createComparisonResult(hasEmbeddedText, similarity, message) {
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

// State
let currentFile = null;
let currentPdf = null;
let currentFileType = null; // 'pdf' or 'docx'
let currentFileUrl = null;
let comparisonResult = null;
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
        console.error('Error loading PDF preview:', error);
        alert('Error loading PDF preview');
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

            comparisonResult = createComparisonResult(
                true, 100, 'Text extracted directly from document (100% accuracy)'
            );

        } else {
            if (!currentPdf) throw new Error('PDF failed to load. Please try re-uploading the file.');

            updateProgress(30, 'Extracting embedded text...');

            const embeddedText = await extractEmbeddedText(currentPdf);

            const hasGoodEmbeddedText = embeddedText &&
                                       embeddedText.trim().length > 100 &&
                                       isTextReadable(embeddedText);

            if (hasGoodEmbeddedText) {
                updateProgress(100, 'Using embedded text (100% accuracy)...');

                comparisonResult = createComparisonResult(
                    true, 100, 'Text extracted directly from PDF (100% accuracy)'
                );
            } else {
                // Embedded text was garbled — redo with OCR
                totalChars = 0;
                totalWords = 0;
                processedPages = 0;
                displayedPages = 0;
                resultText.textContent = '';
                await clearAll();

                updateProgress(50, 'Embedded text is garbled - performing OCR...');
                await extractTextFromPdf(currentPdf);

                updateProgress(100, 'OCR complete');

                comparisonResult = createComparisonResult(
                    false, 100, 'OCR extraction complete - embedded text was garbled/unreadable'
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
        displayVerificationResults(comparisonResult);

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

// Light preprocessing - minimal enhancement
function lightPreprocessing(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Very light contrast enhancement only
    for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Very light contrast boost
        const contrast = 1.1;
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        let enhanced = factor * (gray - 128) + 128;
        enhanced = Math.max(0, Math.min(255, enhanced));

        data[i] = enhanced;
        data[i + 1] = enhanced;
        data[i + 2] = enhanced;
    }

    context.putImageData(imageData, 0, 0);
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

// Compare OCR text with embedded text
function compareTexts(ocrText, embeddedText) {
    const result = {
        hasEmbeddedText: embeddedText && embeddedText.trim().length > 50,
        similarity: 0,
        criticalErrors: [],
        structuralDifferences: [],
        textAccuracyIssues: [],
        semanticIntegrity: '',
        overallAssessment: ''
    };

    if (!result.hasEmbeddedText) {
        result.overallAssessment = 'No embedded text found - this is a scanned document. OCR is the only option.';
        result.semanticIntegrity = 'Cannot verify - no reference text available';
        return result;
    }

    // Aggressive normalization for OCR comparison - focus on content not formatting
    const normalizeText = (text) => text
        .toLowerCase()
        // Normalize all whitespace to single spaces
        .replace(/\s+/g, ' ')
        // Remove page markers and common OCR artifacts
        .replace(/---\s*page\s*\d+\s*---/gi, '')
        // Normalize quotes and apostrophes
        .replace(/[`'''‛‚]/g, "'")
        .replace(/[""„‟]/g, '"')
        // Normalize dashes
        .replace(/[–—−]/g, '-')
        // Normalize Unicode to compatible form
        .normalize('NFKC')
        // Remove all punctuation and special characters except spaces and Hebrew
        .replace(/[^\w\s\u0590-\u05FF]/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();

    const ocrNorm = normalizeText(ocrText);
    const embedNorm = normalizeText(embeddedText);

    // Use combined similarity metrics for more accurate comparison
    const similarity = calculateCombinedSimilarity(ocrNorm, embedNorm);
    result.similarity = Math.round(similarity * 100);

    // Analyze differences
    if (result.similarity < 95) {
        const ocrWords = ocrNorm.split(' ');
        const embedWords = embedNorm.split(' ');

        // Check for missing sections
        if (Math.abs(ocrWords.length - embedWords.length) > embedWords.length * 0.1) {
            result.criticalErrors.push(
                `Word count mismatch: OCR has ${ocrWords.length} words, embedded text has ${embedWords.length} words`
            );
        }

        // Check for structural issues
        const ocrLines = ocrText.split('\n').length;
        const embedLines = embeddedText.split('\n').length;
        if (Math.abs(ocrLines - embedLines) > 5) {
            result.structuralDifferences.push(
                `Line structure differs: OCR has ${ocrLines} lines, embedded text has ${embedLines} lines`
            );
        }

        // Sample character accuracy
        if (result.similarity < 90) {
            result.textAccuracyIssues.push(
                `Character-level accuracy is below 90% (${result.similarity}%)`
            );
        }
    }

    // Semantic integrity assessment with higher thresholds
    if (result.similarity >= 99) {
        result.semanticIntegrity = 'Excellent - Near-perfect OCR accuracy';
        result.overallAssessment = `Exceptional accuracy (${result.similarity}%) - OCR text is highly reliable`;
    } else if (result.similarity >= 95) {
        result.semanticIntegrity = 'Very Good - OCR text preserves meaning with minimal errors';
        result.overallAssessment = `High accuracy (${result.similarity}%) - OCR text is reliable for most purposes`;
    } else if (result.similarity >= 90) {
        result.semanticIntegrity = 'Good - Minor OCR errors present but overall meaning preserved';
        result.overallAssessment = `Good accuracy (${result.similarity}%) - Review recommended for critical use`;
    } else if (result.similarity >= 80) {
        result.semanticIntegrity = 'Fair - Some OCR errors may affect meaning in certain sections';
        result.overallAssessment = `Moderate accuracy (${result.similarity}%) - Manual review required`;
    } else {
        result.semanticIntegrity = 'Poor - Significant OCR errors likely change meaning';
        result.overallAssessment = `Low accuracy (${result.similarity}%) - Extensive manual correction needed`;
    }

    return result;
}

// Combined similarity using word-level Jaccard + character-level Dice coefficient
function calculateCombinedSimilarity(str1, str2) {
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;

    // Split into words
    const words1 = str1.split(/\s+/).filter(w => w.length > 0);
    const words2 = str2.split(/\s+/).filter(w => w.length > 0);

    // Word-level Jaccard similarity (good for overall content match)
    const wordSet1 = new Set(words1);
    const wordSet2 = new Set(words2);
    const wordIntersection = new Set([...wordSet1].filter(x => wordSet2.has(x)));
    const wordUnion = new Set([...wordSet1, ...wordSet2]);
    const jaccardSimilarity = wordIntersection.size / wordUnion.size;

    // Character-level Dice coefficient (good for handling minor OCR errors)
    const bigrams1 = getBigrams(str1);
    const bigrams2 = getBigrams(str2);
    const bigramMap = new Map();
    for (const b of bigrams2) bigramMap.set(b, (bigramMap.get(b) ?? 0) + 1);
    let intersectionCount = 0;
    for (const b of bigrams1) {
        const count = bigramMap.get(b) ?? 0;
        if (count > 0) { intersectionCount++; bigramMap.set(b, count - 1); }
    }
    const diceSimilarity = (2 * intersectionCount) / (bigrams1.length + bigrams2.length);

    // Weighted combination: favor word-level but account for character errors
    // 70% word similarity + 30% character similarity
    return (jaccardSimilarity * 0.7) + (diceSimilarity * 0.3);
}

// Generate character bigrams for Dice coefficient
function getBigrams(str) {
    const bigrams = [];
    for (let i = 0; i < str.length - 1; i++) {
        bigrams.push(str.substring(i, i + 2));
    }
    return bigrams;
}

// Display verification results in UI
function displayVerificationResults(result) {
    const verificationPanel = document.getElementById('verificationPanel');
    const verificationBadge = document.getElementById('verificationBadge');
    const similarityFill = document.getElementById('similarityFill');
    const criticalErrorsSection = document.getElementById('criticalErrorsSection');
    const criticalErrorsList = document.getElementById('criticalErrorsList');
    const structuralDifferencesSection = document.getElementById('structuralDifferencesSection');
    const structuralDifferencesList = document.getElementById('structuralDifferencesList');
    const textAccuracySection = document.getElementById('textAccuracySection');
    const textAccuracyList = document.getElementById('textAccuracyList');
    const semanticIntegrity = document.getElementById('semanticIntegrity');
    const overallAssessment = document.getElementById('overallAssessment');

    // Show panel
    verificationPanel.classList.add('active');

    // Set badge
    let badgeClass = 'badge-no-text';
    let badgeText = 'No Embedded Text';

    if (result.hasEmbeddedText) {
        if (result.similarity >= 95) {
            badgeClass = 'badge-excellent';
            badgeText = 'Excellent';
        } else if (result.similarity >= 85) {
            badgeClass = 'badge-good';
            badgeText = 'Good';
        } else if (result.similarity >= 70) {
            badgeClass = 'badge-fair';
            badgeText = 'Fair';
        } else {
            badgeClass = 'badge-poor';
            badgeText = 'Poor';
        }
    }

    verificationBadge.className = `verification-badge ${badgeClass}`;
    verificationBadge.textContent = badgeText;

    // Set similarity bar
    similarityFill.style.width = `${result.similarity}%`;
    similarityFill.textContent = `${result.similarity}%`;

    if (result.similarity < 70) {
        similarityFill.style.background = 'linear-gradient(90deg, #dc3545, #c82333)';
    } else if (result.similarity < 85) {
        similarityFill.style.background = 'linear-gradient(90deg, #ffc107, #ff9800)';
    } else if (result.similarity < 95) {
        similarityFill.style.background = 'linear-gradient(90deg, #17a2b8, #138496)';
    } else {
        similarityFill.style.background = 'linear-gradient(90deg, #28a745, #20c997)';
    }

    function populateList(section, list, items) {
        if (items && items.length > 0) {
            section.style.display = 'block';
            list.replaceChildren(...items.map(text => Object.assign(document.createElement('li'), { textContent: text })));
        } else {
            section.style.display = 'none';
        }
    }

    populateList(criticalErrorsSection, criticalErrorsList, result.criticalErrors);
    populateList(structuralDifferencesSection, structuralDifferencesList, result.structuralDifferences);
    populateList(textAccuracySection, textAccuracyList, result.textAccuracyIssues);

    // Semantic integrity and overall assessment
    semanticIntegrity.textContent = result.semanticIntegrity;
    overallAssessment.textContent = result.overallAssessment;
}

// Clear/Reset
clearBtn.addEventListener('click', async () => {
    currentFile = null;
    currentPdf = null;
    currentFileType = null;
    if (currentFileUrl) { URL.revokeObjectURL(currentFileUrl); currentFileUrl = null; }
    comparisonResult = null;
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

    if (comparisonResult) {
        content += '='.repeat(80) + '\n';
        content += 'VERIFICATION REPORT\n';
        content += '='.repeat(80) + '\n\n';

        content += 'Overall Assessment: ' + comparisonResult.overallAssessment + '\n\n';

        if (comparisonResult.hasEmbeddedText) {
            content += 'Similarity Score: ' + comparisonResult.similarity + '%\n\n';
        }

        content += 'Semantic Integrity: ' + comparisonResult.semanticIntegrity + '\n\n';

        if (comparisonResult.criticalErrors && comparisonResult.criticalErrors.length > 0) {
            content += 'CRITICAL ERRORS:\n';
            comparisonResult.criticalErrors.forEach(function(e) { content += '  - ' + e + '\n'; });
            content += '\n';
        }

        if (comparisonResult.structuralDifferences && comparisonResult.structuralDifferences.length > 0) {
            content += 'STRUCTURAL DIFFERENCES:\n';
            comparisonResult.structuralDifferences.forEach(function(d) { content += '  - ' + d + '\n'; });
            content += '\n';
        }

        if (comparisonResult.textAccuracyIssues && comparisonResult.textAccuracyIssues.length > 0) {
            content += 'TEXT ACCURACY ISSUES:\n';
            comparisonResult.textAccuracyIssues.forEach(function(issue) { content += '  - ' + issue + '\n'; });
            content += '\n';
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
    }

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
