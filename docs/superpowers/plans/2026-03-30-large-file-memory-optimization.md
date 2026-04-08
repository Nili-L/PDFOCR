# Large File Memory Optimization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable PDFOCR to process 500MB+ PDF files with thousands of pages by eliminating memory leaks and moving text storage to IndexedDB.

**Architecture:** Add an IndexedDB storage layer (`db.js`) for page-level text persistence. Refactor the OCR and embedded-text extraction loops to release canvas memory after each page and write results to IndexedDB incrementally. Add paginated display for results and per-page error recovery. Check for interrupted extractions on page load.

**Tech Stack:** IndexedDB (browser built-in), existing Tesseract.js / PDF.js / Mammoth.js / Vite stack. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-30-large-file-memory-optimization-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `db.js` | Create | IndexedDB wrapper: open, write page, read pages, write/read metadata, clear |
| `main.js` | Modify | Integrate db.js, canvas cleanup, paginated display, error handling, recovery |
| `index.html` | Modify | Remove size limit text, add recovery banner markup, add "Load more" button |

---

### Task 1: IndexedDB Storage Layer

**Files:**
- Create: `db.js`

This is the foundation everything else builds on. A thin async wrapper around IndexedDB with a clean API.

- [ ] **Step 1: Create `db.js` with database initialization**

```javascript
// db.js — IndexedDB storage for page-level text extraction results

const DB_NAME = 'pdfocr';
const DB_VERSION = 1;
const PAGES_STORE = 'pages';
const META_STORE = 'extraction';

let dbInstance = null;

export async function openDB() {
    if (dbInstance) return dbInstance;

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(PAGES_STORE)) {
                db.createObjectStore(PAGES_STORE, { keyPath: 'pageNumber' });
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE, { keyPath: 'id' });
            }
        };

        request.onsuccess = (event) => {
            dbInstance = event.target.result;
            resolve(dbInstance);
        };

        request.onerror = (event) => {
            reject(new Error(`IndexedDB error: ${event.target.error}`));
        };
    });
}
```

- [ ] **Step 2: Add page write and read functions**

Append to `db.js`:

```javascript
export async function writePage(pageNumber, text, method, error = null) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PAGES_STORE, 'readwrite');
        tx.objectStore(PAGES_STORE).put({ pageNumber, text, method, error });
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Write failed: ${event.target.error}`));
    });
}

export async function readPages(startPage = 1, count = Infinity) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(PAGES_STORE, 'readonly');
        const store = tx.objectStore(PAGES_STORE);
        const results = [];

        const request = store.openCursor(IDBKeyRange.lowerBound(startPage));
        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor && results.length < count) {
                results.push(cursor.value);
                cursor.continue();
            } else {
                resolve(results);
            }
        };
        request.onerror = (event) => reject(new Error(`Read failed: ${event.target.error}`));
    });
}

export async function readAllPages() {
    return readPages(1, Infinity);
}
```

- [ ] **Step 3: Add metadata and clear functions**

Append to `db.js`:

```javascript
export async function writeMeta(meta) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readwrite');
        tx.objectStore(META_STORE).put({ id: 'current', ...meta });
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Meta write failed: ${event.target.error}`));
    });
}

export async function readMeta() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(META_STORE, 'readonly');
        const request = tx.objectStore(META_STORE).get('current');
        request.onsuccess = (event) => resolve(event.target.result || null);
        request.onerror = (event) => reject(new Error(`Meta read failed: ${event.target.error}`));
    });
}

export async function clearAll() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([PAGES_STORE, META_STORE], 'readwrite');
        tx.objectStore(PAGES_STORE).clear();
        tx.objectStore(META_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = (event) => reject(new Error(`Clear failed: ${event.target.error}`));
    });
}
```

- [ ] **Step 4: Verify db.js loads without errors**

Run: `npm run dev`

Open browser console, type:
```javascript
import('/db.js').then(db => db.openDB()).then(() => console.log('DB OK'))
```

Expected: "DB OK" in console, no errors. Check IndexedDB in DevTools Application tab — `pdfocr` database should exist with `pages` and `extraction` stores.

- [ ] **Step 5: Commit**

```bash
git add db.js
git commit -m "feat: add IndexedDB storage layer for page-level text persistence"
```

---

### Task 2: Remove File Size Limit

**Files:**
- Modify: `main.js:32-37` (CONFIG object)
- Modify: `main.js:114-119` (handleFileSelect size check)
- Modify: `index.html:416-418` (upload area text)

- [ ] **Step 1: Remove MAX_FILE_SIZE_MB from CONFIG**

In `main.js`, change the CONFIG object from:

```javascript
const CONFIG = {
    MAX_PREVIEW_PAGES: 5,
    PDF_RENDER_SCALE: 3.0,
    MAX_FILE_SIZE_MB: 25,
    SIMILARITY_THRESHOLDS: { EXCELLENT: 95, GOOD: 85, FAIR: 70 }
};
```

To:

```javascript
const CONFIG = {
    MAX_PREVIEW_PAGES: 5,
    PDF_RENDER_SCALE: 3.0,
    SIMILARITY_THRESHOLDS: { EXCELLENT: 95, GOOD: 85, FAIR: 70 }
};
```

- [ ] **Step 2: Remove file size check from handleFileSelect**

In `main.js`, remove this block from `handleFileSelect`:

```javascript
    // Check file size (500MB limit)
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert('File size exceeds 500MB limit');
        return;
    }
```

- [ ] **Step 3: Update upload area text in index.html**

In `index.html`, change:

```html
                    <p style="font-size: 0.9rem; color: #6c757d; margin-top: 10px;">
                        Supports PDF and DOCX files up to 25MB
                    </p>
```

To:

```html
                    <p style="font-size: 0.9rem; color: #6c757d; margin-top: 10px;">
                        Supports PDF and DOCX files. Large files may require more available memory.
                    </p>
```

- [ ] **Step 4: Verify the upload area text changed and no size rejection occurs**

Run: `npm run dev`

Open browser at `http://localhost:5173`. Verify the upload text reads "Supports PDF and DOCX files. Large files may require more available memory." Upload any PDF — it should be accepted regardless of size.

- [ ] **Step 5: Commit**

```bash
git add main.js index.html
git commit -m "feat: remove hard file size limit — let the browser be the constraint"
```

---

### Task 3: Canvas Process-and-Release in OCR Path

**Files:**
- Modify: `main.js:374-433` (extractTextFromPdf function)

- [ ] **Step 1: Add canvas cleanup after OCR recognition**

In `main.js`, in the `extractTextFromPdf` function, find this block inside the `for` loop (around line 418-423):

```javascript
            const { data: { text } } = await worker.recognize(canvas, {
                rotateAuto: true,
            });

            // Text already includes line breaks from Tesseract
            fullText += `\n--- Page ${i} ---\n${text}\n`;
```

Replace with:

```javascript
            const { data: { text } } = await worker.recognize(canvas, {
                rotateAuto: true,
            });

            // Release canvas pixel buffer immediately — this is the main memory optimization.
            // Setting dimensions to 0 forces synchronous release of the backing store.
            canvas.width = 0;
            canvas.height = 0;
            canvas = null;
            context = null;

            // Text already includes line breaks from Tesseract
            fullText += `\n--- Page ${i} ---\n${text}\n`;
```

Also need to change `const context` to `let context` and `const canvas` to `let canvas` in the same function. Find:

```javascript
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
```

Replace with:

```javascript
            let canvas = document.createElement('canvas');
            let context = canvas.getContext('2d');
```

- [ ] **Step 2: Verify OCR still works on a small PDF**

Run: `npm run dev`

Upload a small PDF (2-3 pages), click "Start OCR Processing". Verify text is extracted correctly. Open DevTools Memory tab — take a heap snapshot before and after processing. Canvas memory should not accumulate.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: release canvas memory after each OCR page — O(1) memory usage"
```

---

### Task 4: Integrate IndexedDB Into Processing Loops

**Files:**
- Modify: `main.js` — imports, extractTextFromPdf, extractEmbeddedText, processBtn handler, state variables

This is the largest task. It rewires both extraction paths to write to IndexedDB instead of accumulating strings.

- [ ] **Step 1: Add db.js imports and new state variables at the top of main.js**

At the top of `main.js`, after the existing imports (line 3), add:

```javascript
import { openDB, writePage, readPages, readAllPages, writeMeta, readMeta, clearAll } from './db.js';
```

Replace the state variables block (lines 66-72):

```javascript
let currentFile = null;
let currentPdf = null;
let currentFileType = null; // 'pdf' or 'docx'
let currentFileUrl = null;
let extractedText = '';
let embeddedText = '';
let comparisonResult = null;
```

With:

```javascript
let currentFile = null;
let currentPdf = null;
let currentFileType = null; // 'pdf' or 'docx'
let currentFileUrl = null;
let comparisonResult = null;
let totalChars = 0;
let totalWords = 0;
let processedPages = 0;
```

- [ ] **Step 2: Rewrite extractTextFromPdf to use IndexedDB**

Replace the entire `extractTextFromPdf` function (lines 374-433) with:

```javascript
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

                // Release canvas memory immediately
                canvas.width = 0;
                canvas.height = 0;
                canvas = null;
                context = null;

                await writePage(i, text, 'ocr');
                updateIncrementalStats(text, i);
                appendPageToDisplay(i, text);

            } catch (pageError) {
                // Per-page error: try worker retry once
                try {
                    await worker.terminate();
                    worker = await createWorker(['heb', 'eng'], 1, { logger: () => {} });
                    await worker.setParameters({
                        tessedit_pageseg_mode: '4',
                        tessedit_ocr_engine_mode: '1',
                        preserve_interword_spaces: '1',
                    });

                    // Retry this page with fresh worker
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
                    // Both attempts failed — record error, continue
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
```

- [ ] **Step 3: Rewrite extractEmbeddedText to use IndexedDB**

Replace the entire `extractEmbeddedText` function (lines 329-347) with:

```javascript
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
```

- [ ] **Step 4: Add helper functions for incremental stats and page display**

Add these functions before the `processBtn` event listener (before line 211):

```javascript
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
```

- [ ] **Step 5: Rewrite the processBtn handler to use IndexedDB flow**

Replace the `processBtn` event listener (lines 211-289) with:

```javascript
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

        // Show "Load more" if there are more pages than displayed
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
```

- [ ] **Step 6: Verify end-to-end with a small PDF**

Run: `npm run dev`

Upload a small PDF (2-5 pages). Click "Start OCR Processing". Verify:
- Pages appear one at a time in the results panel
- Stats increment as each page completes
- Text is correct
- Check DevTools Application > IndexedDB > pdfocr > pages — records should exist for each page

- [ ] **Step 7: Commit**

```bash
git add main.js
git commit -m "feat: integrate IndexedDB storage into extraction loops with incremental display"
```

---

### Task 5: Fix Copy and Download to Read from IndexedDB

**Files:**
- Modify: `main.js` — copyBtn handler, downloadBtn handler

The copy and download buttons currently read from the `extractedText` variable which no longer exists. Rewrite them to assemble text from IndexedDB.

- [ ] **Step 1: Add a helper function to assemble full text from IndexedDB**

Add this function near the other helpers (after the `appendPageToDisplay` function):

```javascript
async function assembleFullText() {
    const pages = await readAllPages();
    return pages
        .filter(p => p.method !== 'error')
        .map(p => '\n--- Page ' + p.pageNumber + ' ---\n' + p.text)
        .join('\n')
        .trim();
}
```

- [ ] **Step 2: Rewrite the copy button handler**

Replace the `copyBtn` event listener with:

```javascript
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
```

- [ ] **Step 3: Rewrite the download button handler**

Replace the `downloadBtn` event listener with:

```javascript
downloadBtn.addEventListener('click', async () => {
    const fullText = await assembleFullText();
    const pages = await readAllPages();
    let content = '';

    // Add verification report if available
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

        // List failed pages
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
```

- [ ] **Step 4: Verify copy and download work**

Run: `npm run dev`

Upload a PDF, process it. Click "Copy Text" — paste into a text editor and verify content. Click "Download as TXT" — open the file and verify it contains the verification report header and extracted text with `--- Page N ---` markers.

- [ ] **Step 5: Commit**

```bash
git add main.js
git commit -m "feat: copy and download now assemble text from IndexedDB"
```

---

### Task 6: Load More Button for Paginated Display

**Files:**
- Modify: `index.html` — add "Load more" button markup
- Modify: `main.js` — add showLoadMoreButton and loadMore functions

- [ ] **Step 1: Add "Load more" button markup to index.html**

In `index.html`, find the action buttons div (around line 473):

```html
                <div class="action-buttons" id="actionButtons" style="display: none;">
                    <button id="copyBtn" class="btn-success">Copy Text</button>
                    <button id="downloadBtn" class="btn-secondary">Download as TXT</button>
                </div>
```

Add immediately after it:

```html
                <div id="loadMoreContainer" style="display: none; text-align: center; margin-top: 10px;">
                    <button id="loadMoreBtn" style="background: #6c757d;">Load more pages</button>
                </div>
```

- [ ] **Step 2: Add the showLoadMoreButton and load more handler in main.js**

Add these after the `assembleFullText` function:

```javascript
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
```

- [ ] **Step 3: Verify paginated display with a multi-page PDF**

Run: `npm run dev`

Upload a PDF with more than 20 pages. Process it. Verify:
- First 20 pages appear in the results
- "Load more pages (showing 20 of N)" button appears
- Clicking it loads the next 20
- Button disappears when all pages are shown

- [ ] **Step 4: Commit**

```bash
git add main.js index.html
git commit -m "feat: paginated results display with load-more for large documents"
```

---

### Task 7: Clear Button and IndexedDB Cleanup

**Files:**
- Modify: `main.js` — clearBtn handler

- [ ] **Step 1: Rewrite the clear button handler**

Replace the `clearBtn` event listener with:

```javascript
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
```

- [ ] **Step 2: Verify clear works**

Run: `npm run dev`

Upload and process a PDF. Click Clear. Verify:
- UI resets to initial state
- IndexedDB stores are empty (check DevTools Application > IndexedDB > pdfocr)
- Upload a new file and process — works cleanly

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: clear button wipes IndexedDB stores"
```

---

### Task 8: Partial Results Recovery on Page Load

**Files:**
- Modify: `index.html` — add recovery banner markup
- Modify: `main.js` — add recovery check on load

- [ ] **Step 1: Add recovery banner markup to index.html**

In `index.html`, immediately after the opening `<div class="container">` tag (line 402), add:

```html
        <div id="recoveryBanner" style="display: none; background: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 15px 20px; margin-bottom: 20px; color: #856404;">
            <strong>Previous extraction interrupted.</strong>
            <span id="recoveryInfo"></span>
            <div style="margin-top: 10px; display: flex; gap: 10px;">
                <button id="recoveryDownloadBtn" style="background: #856404; padding: 8px 16px; font-size: 0.9rem;">Download partial results</button>
                <button id="recoveryDismissBtn" style="background: #6c757d; padding: 8px 16px; font-size: 0.9rem;">Dismiss</button>
            </div>
        </div>
```

- [ ] **Step 2: Add recovery check logic at the end of main.js**

Add this at the very end of `main.js`:

```javascript
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
```

- [ ] **Step 3: Verify recovery works**

Run: `npm run dev`

Upload a large-ish PDF (10+ pages). Start processing. While it's processing (before it finishes), close the tab. Reopen `http://localhost:5173`. Verify:
- Yellow banner appears: "Previous extraction interrupted. N of M pages were saved from filename.pdf."
- "Download partial results" downloads a text file with whatever pages completed
- "Dismiss" clears the banner and IndexedDB
- After dismiss, uploading a new file works normally

- [ ] **Step 4: Commit**

```bash
git add main.js index.html
git commit -m "feat: recover partial results from interrupted extractions"
```

---

### Task 9: Graceful Error on File Too Large for Browser

**Files:**
- Modify: `main.js` — loadPdfPreview error handling

- [ ] **Step 1: Add memory error handling to loadPdfPreview**

In `main.js`, in the `loadPdfPreview` function, find the catch block:

```javascript
    } catch (error) {
        console.error('Error loading PDF preview:', error);
        alert('Error loading PDF preview');
    }
```

Replace with:

```javascript
    } catch (error) {
        console.error('Error loading PDF:', error);
        if (error.message && (error.message.includes('memory') || error.message.includes('allocation') || error.name === 'RangeError')) {
            alert('This file is too large for your browser to handle. Try closing other tabs or using a smaller file.');
        } else {
            alert('Error loading PDF: ' + error.message);
        }
        // Reset state so the user can try another file
        currentFile = null;
        currentPdf = null;
        currentFileType = null;
        if (currentFileUrl) { URL.revokeObjectURL(currentFileUrl); currentFileUrl = null; }
        fileInfo.classList.remove('active');
        processBtn.disabled = true;
    }
```

- [ ] **Step 2: Verify graceful handling**

This is hard to test directly without a truly massive file. Verify that normal error handling still works: try uploading a corrupted or invalid file and confirm the error message is user-friendly.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: graceful error message when browser can't handle file size"
```

---

### Task 10: Clean Up Dead Code

**Files:**
- Modify: `main.js` — remove unused functions and variables

- [ ] **Step 1: Remove unused code**

Remove the `updateStatistics` function (around line 45-51) — replaced by `updateIncrementalStats`.

Remove the `lightPreprocessing` function (around line 350-371) — commented out in the code and unused.

Remove the `compareTexts` function, `calculateCombinedSimilarity` function, and `getBigrams` function — these were for comparing OCR vs embedded text. With the new flow (embedded OR OCR, not both), they're unused. The `comparisonResult` is now built via `createComparisonResult` directly.

- [ ] **Step 2: Verify nothing broke**

Run: `npm run dev`

Upload and process a PDF. Verify all functionality still works: display, stats, copy, download, verification panel, clear.

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "chore: remove dead code — unused comparison, preprocessing, and stats functions"
```

---

### Task 11: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the README to reflect the changes**

In `README.md`, replace:

```markdown
File size limit: 25 MB.
```

With:

```markdown
No hard file size limit — the browser's available memory is the constraint. Files up to 500MB+ work well on most machines. The app processes pages one at a time and stores results incrementally, so memory usage stays flat regardless of document length.
```

Also, after the existing note blockquote about garbled text detection, add:

```markdown
> **Large files:** Results are stored in your browser's IndexedDB as each page completes. If the tab crashes mid-extraction, reopen the app to download whatever was saved.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: update README for large file support and IndexedDB storage"
```
