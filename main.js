import * as pdfjsLib from 'pdfjs-dist';
import { createWorker } from 'tesseract.js';
import mammoth from 'mammoth';

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
let currentFileType = null; // 'pdf' or 'docx'
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
    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
        alert('File size exceeds 500MB limit');
        return;
    }

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
    const icon = currentFileType === 'pdf' ? '📄' : '📝';
    fileName.textContent = `${icon} ${file.name}`;
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

// Process Document (PDF or DOCX)
processBtn.addEventListener('click', async () => {
    if (!currentFile) return;

    processBtn.disabled = true;
    clearBtn.disabled = true;
    progressContainer.classList.add('active');

    try {
        if (currentFileType === 'docx') {
            // Process DOCX file
            progressFill.style.width = '50%';
            progressFill.textContent = '50%';
            progressText.textContent = 'Extracting text from DOCX...';

            extractedText = await extractTextFromDocx(currentFile);
            embeddedText = extractedText; // For DOCX, embedded text is the extracted text

            progressFill.style.width = '100%';
            progressFill.textContent = '100%';
            progressText.textContent = 'Complete!';

            // For DOCX, no OCR comparison needed
            comparisonResult = {
                hasEmbeddedText: true,
                similarity: 100,
                criticalErrors: [],
                structuralDifferences: [],
                textAccuracyIssues: [],
                semanticIntegrity: 'Direct text extraction from DOCX - no OCR required',
                overallAssessment: 'Text extracted directly from document (100% accuracy)'
            };

            // Display results
            resultText.textContent = extractedText || 'No text extracted';

            // Update stats
            const chars = extractedText.length;
            const words = extractedText.trim().split(/\s+/).filter(w => w.length > 0).length;

            charCount.textContent = chars.toLocaleString();
            wordCount.textContent = words.toLocaleString();
            pageCount.textContent = '-';

        } else {
            // Process PDF file
            if (!currentPdf) return;

            // First, extract embedded text
            progressFill.style.width = '30%';
            progressFill.textContent = '30%';
            progressText.textContent = 'Extracting embedded text...';

            embeddedText = await extractEmbeddedText(currentPdf);

            // Check if embedded text is sufficient (not a scanned PDF)
            const hasGoodEmbeddedText = embeddedText && embeddedText.trim().length > 100;

            if (hasGoodEmbeddedText) {
                // Use embedded text directly - it's 100% accurate
                progressFill.style.width = '100%';
                progressFill.textContent = '100%';
                progressText.textContent = 'Using embedded text (100% accuracy)...';

                extractedText = embeddedText;

                comparisonResult = {
                    hasEmbeddedText: true,
                    similarity: 100,
                    criticalErrors: [],
                    structuralDifferences: [],
                    textAccuracyIssues: [],
                    semanticIntegrity: 'Direct text extraction from PDF - no OCR required',
                    overallAssessment: 'Text extracted directly from PDF (100% accuracy)'
                };
            } else {
                // No embedded text - perform OCR
                progressFill.style.width = '50%';
                progressFill.textContent = '50%';
                progressText.textContent = 'No embedded text found - performing OCR...';

                extractedText = await extractTextFromPdf(currentPdf);

                // Compare OCR with embedded text (if any)
                progressFill.style.width = '100%';
                progressFill.textContent = '100%';
                progressText.textContent = 'Comparing results...';

                comparisonResult = compareTexts(extractedText, embeddedText);
            }

            // Display results
            resultText.textContent = extractedText || 'No text extracted';

            // Update stats
            const chars = extractedText.length;
            const words = extractedText.trim().split(/\s+/).filter(w => w.length > 0).length;

            charCount.textContent = chars.toLocaleString();
            wordCount.textContent = words.toLocaleString();
            pageCount.textContent = currentPdf.numPages;
        }

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

// Extract embedded text from PDF while preserving formatting
async function extractEmbeddedText(pdf) {
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Reconstruct text with proper spacing and line breaks
        let pageText = '';
        let lastY = null;
        let lastX = null;

        textContent.items.forEach((item, index) => {
            const currentY = item.transform[5]; // Y position
            const currentX = item.transform[4]; // X position
            const text = item.str;

            if (lastY !== null) {
                // New line if Y position changed significantly
                if (Math.abs(currentY - lastY) > 5) {
                    pageText += '\n';
                    lastX = null;
                }
                // Add space if on same line but with horizontal gap
                else if (lastX !== null) {
                    const gap = currentX - lastX;
                    // Add space if there's a meaningful gap (more than 1 pixel)
                    if (gap > 1) {
                        pageText += ' ';
                    }
                }
            }

            // Add the text (it may already contain spaces)
            pageText += text;
            lastY = currentY;
            lastX = currentX + item.width;
        });

        fullText += `\n--- Page ${i} ---\n${pageText.trim()}\n`;
    }

    return fullText.trim();
}

// Preprocess image for better OCR recognition
function preprocessImageForOCR(context, width, height) {
    // Get image data
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale value
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Apply contrast enhancement
        const contrast = 1.2; // Increase contrast by 20%
        const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        const enhanced = factor * (gray - 128) + 128;

        // Apply simple thresholding to make text sharper
        const threshold = 180;
        const final = enhanced > threshold ? 255 : enhanced < 75 ? 0 : enhanced;

        data[i] = final;     // Red
        data[i + 1] = final; // Green
        data[i + 2] = final; // Blue
        // Alpha channel (data[i + 3]) remains unchanged
    }

    // Put the processed image back
    context.putImageData(imageData, 0, 0);
}

// Extract Text from PDF via OCR
async function extractTextFromPdf(pdf) {
    // Support Hebrew and English with optimized settings
    const worker = await createWorker(['heb', 'eng'], 1, {
        logger: () => {} // Suppress verbose logging
    });

    // Configure Tesseract for higher accuracy
    await worker.setParameters({
        tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
        tessedit_ocr_engine_mode: '2', // Use LSTM neural net mode for better accuracy
        preserve_interword_spaces: '1',
    });

    let fullText = '';

    try {
        for (let i = 1; i <= pdf.numPages; i++) {
            // Update progress
            const progress = Math.round((i / pdf.numPages) * 50 + 50);
            progressFill.style.width = `${progress}%`;
            progressFill.textContent = `${progress}%`;
            progressText.textContent = `OCR processing page ${i} of ${pdf.numPages}...`;

            const page = await pdf.getPage(i);
            // Increase scale from 2.0 to 3.0 for higher resolution and better OCR accuracy
            const viewport = page.getViewport({ scale: 3.0 });

            // Render page to canvas with higher quality
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Use better rendering quality
            await page.render({
                canvasContext: context,
                viewport: viewport,
                intent: 'print' // Use print-quality rendering
            }).promise;

            // Apply image preprocessing for better OCR
            preprocessImageForOCR(context, canvas.width, canvas.height);

            // Run OCR on canvas with high quality settings
            const { data: { text } } = await worker.recognize(canvas, {
                rotateAuto: true,
            });

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
    const bigramIntersection = bigrams1.filter(b => bigrams2.includes(b));
    const diceSimilarity = (2 * bigramIntersection.length) / (bigrams1.length + bigrams2.length);

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
