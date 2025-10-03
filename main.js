import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

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

// State
let currentFile = null;
let currentPdf = null;
let extractedText = '';
let embeddedText = '';
let comparisonResult = null;

// Upload Area Events
uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');

    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        handleFileSelect(files[0]);
    } else {
        alert('Please upload a valid PDF file');
    }
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle File Selection
async function handleFileSelect(file) {
    // Check file size (1000MB limit)
    if (file.size > 1000 * 1024 * 1024) {
        alert('File size exceeds 1000MB limit');
        return;
    }

    currentFile = file;

    // Display file info
    fileName.textContent = `📄 ${file.name}`;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    fileInfo.classList.add('active');

    // Enable buttons
    processBtn.disabled = false;
    clearBtn.disabled = false;

    // Load and preview PDF
    await loadPdfPreview(file);
}

// Load PDF Preview
async function loadPdfPreview(file) {
    try {
        const fileUrl = URL.createObjectURL(file);
        const loadingTask = pdfjsLib.getDocument(fileUrl);
        currentPdf = await loadingTask.promise;

        // Clear previous preview
        pdfPreview.innerHTML = '';

        // Show only first 5 pages for preview
        const numPages = Math.min(currentPdf.numPages, 5);

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

        if (currentPdf.numPages > 5) {
            const moreDiv = document.createElement('div');
            moreDiv.className = 'pdf-page';
            moreDiv.style.display = 'flex';
            moreDiv.style.alignItems = 'center';
            moreDiv.style.justifyContent = 'center';
            moreDiv.style.background = '#e9ecef';
            moreDiv.innerHTML = `<p style="text-align: center; color: #6c757d;">+${currentPdf.numPages - 5} more pages</p>`;
            pdfPreview.appendChild(moreDiv);
        }

        previewContainer.style.display = 'block';

    } catch (error) {
        console.error('Error loading PDF preview:', error);
        alert('Error loading PDF preview');
    }
}

// Process PDF with OCR
processBtn.addEventListener('click', async () => {
    if (!currentPdf) return;

    processBtn.disabled = true;
    clearBtn.disabled = true;
    progressContainer.classList.add('active');

    try {
        // First, extract embedded text for comparison
        progressFill.style.width = '25%';
        progressFill.textContent = '25%';
        progressText.textContent = 'Extracting embedded text...';

        embeddedText = await extractEmbeddedText(currentPdf);

        // Then perform OCR
        progressFill.style.width = '50%';
        progressFill.textContent = '50%';
        progressText.textContent = 'Starting OCR processing...';

        extractedText = await extractTextFromPdf(currentPdf);

        // Compare texts for verification
        progressFill.style.width = '100%';
        progressFill.textContent = '100%';
        progressText.textContent = 'Comparing results...';

        comparisonResult = compareTexts(extractedText, embeddedText);

        // Display results
        resultText.textContent = extractedText || 'No text extracted';

        // Update stats
        const chars = extractedText.length;
        const words = extractedText.trim().split(/\s+/).filter(w => w.length > 0).length;

        charCount.textContent = chars.toLocaleString();
        wordCount.textContent = words.toLocaleString();
        pageCount.textContent = currentPdf.numPages;

        statsContainer.style.display = 'flex';
        actionButtons.style.display = 'flex';

        // Display verification results
        displayVerificationResults(comparisonResult);

    } catch (error) {
        console.error('Error processing PDF:', error);
        alert('Error processing PDF: ' + error.message);
        resultText.innerHTML = '<div class="empty-state">Error processing PDF. Please try again.</div>';
    } finally {
        progressContainer.classList.remove('active');
        processBtn.disabled = false;
        clearBtn.disabled = false;
    }
});

// Extract embedded text from PDF
async function extractEmbeddedText(pdf) {
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `\n--- Page ${i} ---\n${pageText}\n`;
    }

    return fullText.trim();
}

// Extract Text from PDF via OCR
async function extractTextFromPdf(pdf) {
    // Support Hebrew and English
    const worker = await createWorker(['heb', 'eng']);
    let fullText = '';

    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            // Update progress
            const progress = Math.round((i / pdf.numPages) * 50 + 50);
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${progress}%`;
            progressText.textContent = `OCR processing page ${i} of ${pdf.numPages}...`;

            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });

            // Render page to canvas
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;

            // Run OCR on canvas
            const { data: { text } } = await worker.recognize(canvas);
            fullText += `\n--- Page ${i} ---\n${text}\n`;
        }

        await worker.terminate();
        return fullText.trim();

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

    // Normalize texts for comparison
    const normalizeText = (text) => text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s\u0590-\u05FF]/g, '')
        .trim();

    const ocrNorm = normalizeText(ocrText);
    const embedNorm = normalizeText(embeddedText);

    // Calculate similarity using Levenshtein-like approach (simple version)
    const similarity = calculateSimilarity(ocrNorm, embedNorm);
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

    // Semantic integrity assessment
    if (result.similarity >= 95) {
        result.semanticIntegrity = 'Excellent - OCR text preserves meaning with minimal errors';
        result.overallAssessment = `High accuracy (${result.similarity}%) - OCR text is reliable for most purposes`;
    } else if (result.similarity >= 85) {
        result.semanticIntegrity = 'Good - Minor OCR errors present but overall meaning preserved';
        result.overallAssessment = `Good accuracy (${result.similarity}%) - Review recommended for critical use`;
    } else if (result.similarity >= 70) {
        result.semanticIntegrity = 'Fair - Multiple OCR errors may affect meaning in some sections';
        result.overallAssessment = `Moderate accuracy (${result.similarity}%) - Manual review required`;
    } else {
        result.semanticIntegrity = 'Poor - Significant OCR errors likely change meaning';
        result.overallAssessment = `Low accuracy (${result.similarity}%) - Extensive manual correction needed`;
    }

    return result;
}

// Simple similarity calculation (Jaccard similarity for speed)
function calculateSimilarity(str1, str2) {
    const words1 = new Set(str1.split(' '));
    const words2 = new Set(str2.split(' '));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
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

    // Critical errors
    if (result.criticalErrors && result.criticalErrors.length > 0) {
        criticalErrorsSection.style.display = 'block';
        criticalErrorsList.innerHTML = result.criticalErrors.map(error => `<li>${error}</li>`).join('');
    } else {
        criticalErrorsSection.style.display = 'none';
    }

    // Structural differences
    if (result.structuralDifferences && result.structuralDifferences.length > 0) {
        structuralDifferencesSection.style.display = 'block';
        structuralDifferencesList.innerHTML = result.structuralDifferences.map(diff => `<li>${diff}</li>`).join('');
    } else {
        structuralDifferencesSection.style.display = 'none';
    }

    // Text accuracy issues
    if (result.textAccuracyIssues && result.textAccuracyIssues.length > 0) {
        textAccuracySection.style.display = 'block';
        textAccuracyList.innerHTML = result.textAccuracyIssues.map(issue => `<li>${issue}</li>`).join('');
    } else {
        textAccuracySection.style.display = 'none';
    }

    // Semantic integrity and overall assessment
    semanticIntegrity.textContent = result.semanticIntegrity;
    overallAssessment.textContent = result.overallAssessment;
}

// Clear/Reset
clearBtn.addEventListener('click', () => {
    currentFile = null;
    currentPdf = null;
    extractedText = '';
    embeddedText = '';
    comparisonResult = null;

    fileInput.value = '';
    fileInfo.classList.remove('active');
    previewContainer.style.display = 'none';
    pdfPreview.innerHTML = '';

    processBtn.disabled = true;
    clearBtn.disabled = true;

    resultText.innerHTML = '<div class="empty-state">Upload a PDF and click "Start OCR Processing" to extract text</div>';
    statsContainer.style.display = 'none';
    actionButtons.style.display = 'none';

    // Hide verification panel
    document.getElementById('verificationPanel').classList.remove('active');

    progressFill.style.width = '0%';
    progressFill.textContent = '0%';
    progressText.textContent = 'Initializing...';
});

// Copy to Clipboard
copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(extractedText);

        const originalText = copyBtn.textContent;
        copyBtn.textContent = '✅ Copied!';

        setTimeout(() => {
            copyBtn.textContent = originalText;
        }, 2000);
    } catch (error) {
        alert('Failed to copy text to clipboard');
    }
});

// Download as TXT with verification report
downloadBtn.addEventListener('click', () => {
    let content = '';

    // Add verification report if available
    if (comparisonResult) {
        content += '=' .repeat(80) + '\n';
        content += 'VERIFICATION REPORT\n';
        content += '='.repeat(80) + '\n\n';

        content += `Overall Assessment: ${comparisonResult.overallAssessment}\n\n`;

        if (comparisonResult.hasEmbeddedText) {
            content += `Similarity Score: ${comparisonResult.similarity}%\n\n`;
        }

        content += `Semantic Integrity: ${comparisonResult.semanticIntegrity}\n\n`;

        if (comparisonResult.criticalErrors && comparisonResult.criticalErrors.length > 0) {
            content += 'CRITICAL ERRORS:\n';
            comparisonResult.criticalErrors.forEach(error => {
                content += `  - ${error}\n`;
            });
            content += '\n';
        }

        if (comparisonResult.structuralDifferences && comparisonResult.structuralDifferences.length > 0) {
            content += 'STRUCTURAL DIFFERENCES:\n';
            comparisonResult.structuralDifferences.forEach(diff => {
                content += `  - ${diff}\n`;
            });
            content += '\n';
        }

        if (comparisonResult.textAccuracyIssues && comparisonResult.textAccuracyIssues.length > 0) {
            content += 'TEXT ACCURACY ISSUES:\n';
            comparisonResult.textAccuracyIssues.forEach(issue => {
                content += `  - ${issue}\n`;
            });
            content += '\n';
        }

        content += '='.repeat(80) + '\n';
        content += 'EXTRACTED TEXT\n';
        content += '='.repeat(80) + '\n\n';
    }

    // Add extracted text
    content += extractedText;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentFile.name.replace('.pdf', '')}_ocr_verified.txt`;
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
