# Large File Memory Optimization

**Date:** 2026-03-30
**Status:** Approved

## Problem

PDFOCR currently holds all canvases, all extracted text, and the full file in memory simultaneously. A 100-page PDF at 3x OCR scale leaks ~3.5GB of canvas data alone. The hard-coded 25MB file size limit exists because anything larger risks crashing the browser tab.

## Goal

Push the browser-based processing ceiling as high as possible — targeting 500MB+ files with thousands of pages — while maintaining the current UX for small files. Degrade gracefully when the browser runs out of memory.

## Design

### 1. Canvas Process-and-Release

**Current:** `extractTextFromPdf` creates a canvas per page in a loop. Canvases are never destroyed. Each A4 page at 3x scale is ~35MB of pixel data.

**Change:** After `worker.recognize(canvas)` returns, immediately release the canvas:

```javascript
canvas.width = 0;
canvas.height = 0;
canvas = null;
```

Setting width/height to 0 forces the browser to release the backing pixel buffer synchronously. Nulling the reference allows GC to collect the canvas element.

**Scope:** Only the OCR loop canvases. The preview canvases (max 5 at 0.5x scale, ~1MB total) are displayed to the user and left alone.

**Result:** Peak canvas memory drops from `O(pages)` to `O(1)` — one page at a time, ~35MB regardless of document size.

### 2. IndexedDB Page-Level Storage

**Current:** Extracted text accumulates in a `fullText` string via concatenation. The entire string lives in memory.

**Change:** Store each page's text in IndexedDB as it completes.

**Database:** `pdfocr`

**Object store:** `pages`, keyed by `pageNumber` (auto-incrementing not needed — page numbers are known).

**Record shape:**

```javascript
{
  pageNumber: 1,           // integer, unique key
  text: "...",             // extracted text for this page
  method: "ocr",           // "ocr", "embedded", or "error"
  error: null              // error message if method is "error"
}
```

**Metadata store:** `extraction`, single record keyed by `id: "current"`:

```javascript
{
  id: "current",
  fileName: "document.pdf",
  totalPages: 1200,
  completedPages: 346,
  startedAt: "2026-03-30T12:00:00Z",
  status: "in_progress"    // "in_progress" or "completed"
}
```

**Lifecycle:**

- **New file upload or Clear:** Delete all records from both stores.
- **Processing starts:** Write metadata record with `status: "in_progress"`.
- **Each page completes:** Write page record, update `completedPages` in metadata.
- **Processing finishes:** Update metadata `status` to `"completed"`.
- **Copy to clipboard:** Read all page records ordered by `pageNumber`, concatenate, copy.
- **Download as TXT:** Same read-and-concatenate, then write to blob.

### 3. No Hard File Size Limit

**Current:** `CONFIG.MAX_FILE_SIZE_MB: 25` rejects files upfront. The UI says "up to 25MB".

**Change:** Remove the `MAX_FILE_SIZE_MB` config and the size check in `handleFileSelect`. Accept any file. If `URL.createObjectURL` or `pdfjsLib.getDocument` fails due to memory, catch the error and display:

> "This file is too large for your browser to handle. Try closing other tabs or using a smaller file."

**UI text** changes from "Supports PDF and DOCX files up to 25MB" to "Supports PDF and DOCX files. Large files may require more available memory."

The browser itself is the limit. Users with more RAM can process bigger files.

### 4. Paginated Results Display

**Current:** All extracted text is dumped into `<div id="resultText">` as one string. Megabytes of text in a single DOM node causes the browser to hang on rendering.

**Change:** Display results in pages, 20 at a time.

- As each page completes during processing, append it to the results panel immediately (the user sees progress live).
- After 20 pages are visible, further pages are stored in IndexedDB but not rendered.
- A "Load more" button (or scroll-triggered loading) fetches the next batch of 20 from IndexedDB.
- Each page in the display is wrapped in a container with a "Page N" header, so the `--- Page N ---` text markers are not stored in IndexedDB. The markers are re-added when assembling text for copy/download so the output file remains readable.

**Incremental stats:** `charCount`, `wordCount`, and `pageCount` update after each page completes instead of once at the end. The user sees the numbers climb in real time.

### 5. Error Handling and Resilience

#### Per-page error recovery

If OCR fails on a single page (Tesseract error, canvas rendering failure, etc.):

- Catch the error for that page.
- Write an error record to IndexedDB: `{ pageNumber: N, text: "", method: "error", error: "message" }`.
- Log to console.
- Continue to the next page.
- The verification report lists which pages failed: "Pages 347, 892 failed to process."

The user gets partial results rather than losing everything.

#### Tesseract worker retry

If `worker.recognize()` throws or the worker becomes unresponsive:

- Terminate the current worker.
- Create a new worker with the same language and parameter configuration.
- Retry the current page once.
- If the retry also fails, record as error and move on.

#### Partial results recovery

On page load, check IndexedDB for an extraction with `status: "in_progress"`:

- If found, display a banner: "A previous extraction was interrupted (N of M pages completed). [Download partial results] [Dismiss]"
- "Download partial results" assembles whatever pages exist and downloads as TXT.
- "Dismiss" clears the IndexedDB stores.
- A new file upload always clears previous data regardless.

This handles tab crashes, accidental navigation, and browser restarts.

## Files Changed

All changes are in two files:

- **`main.js`** — All processing logic: canvas cleanup, IndexedDB operations, paginated display, error handling, recovery check on load.
- **`index.html`** — Updated upload area text (remove size limit), results panel structure for paginated display, recovery banner markup.

No new files. No new dependencies. IndexedDB is a browser built-in.

## What's NOT Changing

- **Preview behavior** — Still max 5 pages at 0.5x scale. Small memory footprint, no change needed.
- **DOCX extraction** — Mammoth.js reads the full file via `arrayBuffer()`. DOCX files are inherently smaller than scanned PDFs (they're zipped XML). No optimization needed.
- **Tesseract configuration** — Same languages (heb, eng), same parameters, same 3x render scale.
- **Verification/comparison logic** — `compareTexts` and `calculateCombinedSimilarity` are unchanged. They run at the end against assembled text.
- **Vite config and deployment** — No build changes.

## Memory Profile (Expected)

| Scenario | Current | After |
|----------|---------|-------|
| 10-page PDF, embedded text | ~20MB | ~20MB (no change) |
| 10-page PDF, OCR | ~370MB (canvases) | ~55MB (1 canvas + overhead) |
| 500-page PDF, OCR | ~17.5GB (crash) | ~55MB steady state |
| 1000-page PDF, OCR | crash | ~55MB steady state |

Peak memory during OCR is dominated by: the PDF blob in memory + one rendered canvas (~35MB) + Tesseract worker memory (~20MB). This is roughly constant regardless of page count.

## Testing Strategy

- **Small file (< 10 pages):** Verify behavior is unchanged. Results display instantly as before.
- **Medium file (50-100 pages):** Verify incremental display, stats update live, canvas memory doesn't grow (check via browser DevTools Memory tab).
- **Large file (500+ pages):** Verify the app doesn't crash. Memory stays flat. Paginated display works. Download assembles full text.
- **Error injection:** Kill the Tesseract worker mid-processing (via DevTools), verify it recovers and continues.
- **Tab crash recovery:** Start a large extraction, close the tab, reopen — verify the recovery banner appears and partial download works.
- **Clear/new file:** Verify IndexedDB is wiped when uploading a new file or clicking Clear.
