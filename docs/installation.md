# Install and deploy PDFOCR

PDFOCR is a static web app — no backend, no database server, and no runtime dependencies beyond a browser. "Installing" it means either opening the hosted version, serving the built files from your own infrastructure, or running the dev server locally.

## Use the hosted version

Open [nili-l.github.io/PDFOCR](https://nili-l.github.io/PDFOCR/). The app loads entirely in your browser and processes files locally.

## Self-hosting

PDFOCR builds to a set of static files (`index.html`, JavaScript bundles, and a PDF.js worker). Any static file server can host it.

### Build the app

```bash
git clone https://github.com/Nili-L/PDFOCR.git
cd PDFOCR
npm install
npm run build
```

The output goes to `dist/`. The directory contains:

```
dist/
  index.html
  assets/
    index-[hash].js       (~890 KB — Tesseract.js, PDF.js, Mammoth, app code)
    pdf.worker.min-[hash].js  (~1 MB — PDF.js web worker, loaded on demand)
```

### Serve from a subdirectory path

The default build assumes the app lives at a subdirectory path (`/PDFOCR/`), configured in `vite.config.js`:

```javascript
export default {
  base: '/PDFOCR/',
}
```

If you're deploying to a different path, change `base` before building:

- **Root of a domain** (for example, `https://ocr.example.com/`): set `base: '/'`
- **Different subdirectory** (for example, `https://example.com/tools/ocr/`): set `base: '/tools/ocr/'`

### GitHub Pages (automatic)

The repo includes a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds and deploys on every push to `main`. To use it on your own fork:

1. Fork the repo.
2. Go to **Settings** > **Pages** > **Source**, and then select **GitHub Actions**.
3. Push to `main`. The workflow builds and deploys automatically.
4. Your app is at `https://<your-username>.github.io/PDFOCR/`.

### Nginx

```nginx
server {
    listen 80;
    server_name ocr.example.com;
    root /var/www/pdfocr;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache the large JS bundles — they have content hashes in their filenames
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Copy the `dist/` contents to `/var/www/pdfocr/` (or wherever your `root` points). If serving from a subdirectory, update `base` in `vite.config.js` before building.

### Apache

```apache
<VirtualHost *:80>
    ServerName ocr.example.com
    DocumentRoot /var/www/pdfocr

    <Directory /var/www/pdfocr>
        Options -Indexes
        AllowOverride None
        Require all granted

        # SPA fallback
        FallbackResource /index.html
    </Directory>

    # Cache hashed assets
    <LocationMatch "^/assets/">
        Header set Cache-Control "public, max-age=31536000, immutable"
    </LocationMatch>
</VirtualHost>
```

### Docker

To get a quick deployment running:

```bash
npm run build
docker run --rm -p 8080:80 -v $(pwd)/dist:/usr/share/nginx/html:ro nginx:alpine
```

The app opens at `http://localhost:8080`. For a subdirectory deployment, update `base` in `vite.config.js` before building.

### Caddy

```
ocr.example.com {
    root * /var/www/pdfocr
    file_server
    try_files {path} /index.html
}
```

### Notes for all deployments

- **No server-side processing is required.** The app is pure client-side JavaScript. Any static file server works.
- **HTTPS is recommended** but not required. The app uses `navigator.clipboard` for the copy feature, which requires a secure context (HTTPS or localhost) in most browsers.
- **CORS isn't a concern.** The app makes no external network requests. All processing is local.
- **IndexedDB** is used for storing extraction results. Browsers allocate storage per origin, typically 50% or more of available disk space. No server-side storage is needed.

---

# Developer setup

This section is for people who want to modify PDFOCR, not only deploy it.

## Prerequisites

- Node.js 16 or later and npm
- A modern browser with developer tools (Chrome is recommended for memory profiling)

## Clone and run

```bash
git clone https://github.com/Nili-L/PDFOCR.git
cd PDFOCR
npm install
npm run dev
```

The app opens at `http://localhost:5173/PDFOCR/`. Vite hot-reloads on file changes.

## Project structure

```
PDFOCR/
  index.html       All HTML and CSS (single-page app, styles are inline)
  main.js          All application logic — extraction, OCR, display, IndexedDB integration
  db.js            IndexedDB wrapper — page storage, metadata, clear
  vite.config.js   Build config (base path)
  package.json     Dependencies and scripts
  .github/
    workflows/
      deploy.yml   GitHub Pages auto-deploy on push to main
  docs/
    installation.md          This file
    superpowers/
      specs/                 Design specs
      plans/                 Implementation plans
      code-review-*.md       Code review reports
```

There are two files with application code: `main.js` (UI, extraction logic, event handlers) and `db.js` (IndexedDB storage). Everything else is configuration or documentation.

## Code organization

`main.js` has these sections, roughly in order:

1. **Imports and config** — PDF.js, Tesseract.js, Mammoth, db.js imports. `CONFIG` object with preview page limit and OCR render scale.
2. **DOM references** — All `getElementById` calls at the top.
3. **State variables** — `currentFile`, `currentPdf`, `processedPages`, `totalChars`, etc.
4. **Upload handling** — Drag-and-drop, file input, file type detection, PDF preview rendering.
5. **Helper functions** — `updateProgress`, `updateIncrementalStats`, `appendPageToDisplay`, `assembleFullText`, `showLoadMoreButton`, `createExtractionSummary`.
6. **Processing** — `processBtn` click handler orchestrates the extraction flow:
   - DOCX: direct extraction via Mammoth
   - PDF with good embedded text: uses `extractEmbeddedText`
   - PDF with garbled/missing text (or Force OCR): uses `extractTextFromPdf`
7. **Extraction functions** — `extractTextFromDocx`, `isTextReadable`, `extractEmbeddedText`, and `extractTextFromPdf` (with per-page error handling and worker retry).
8. **Display** — `displayExtractionSummary` shows the extraction method in the verification panel.
9. **Clear** — Wipes state, IndexedDB, and the DOM.
10. **Copy and download** — Assembles text from IndexedDB and generates files.
11. **Recovery** — `checkRecovery` IIFE runs on page load and checks for interrupted extractions.

## Key design decisions

**IndexedDB over in-memory storage.** Extracted text is written to IndexedDB page by page as each page completes. This keeps memory usage at O(1) regardless of document length, and partial results survive tab crashes. The trade-off is async I/O for every page write, but IndexedDB transactions are fast enough that the overhead isn't noticeable.

**Canvas process-and-release.** During OCR, each page is rendered to a canvas at 3x scale (approximately 35 MB of pixel data per page). After Tesseract reads it, the canvas is immediately released (`canvas.width = 0; canvas = null`). Without this, a 100-page PDF would leak approximately 3.5 GB of canvas memory.

**Embedded text first, OCR as fallback.** PDFs with good embedded text don't need OCR at all — extraction is instant and accurate. The app checks readability (50% or more recognizable characters) to decide. The **Force OCR** checkbox bypasses this check for testing.

**Per-page error recovery with worker retry.** If Tesseract fails on a page, the worker is terminated and re-created, and then the page is retried once. If it fails again, the page is recorded as an error and processing continues. One bad page doesn't stop the whole document.

## Make changes

### Add a new OCR language

In `main.js`, find the two `createWorker` calls (one in the main OCR path and one in the retry path) and add the language code:

```javascript
const worker = await createWorker(['heb', 'eng', 'ara']);
```

Both calls must match — the retry path re-creates the worker with the same config.

### Change the OCR render scale

In the `CONFIG` object at the top of `main.js`:

```javascript
PDF_RENDER_SCALE: 3.0,
```

Higher values produce better OCR results but use more memory per page and take longer. A value of 2.0 is a reasonable trade-off for speed, and 4.0 is the practical maximum before memory becomes a problem.

### Change the display page limit

The constant `DISPLAY_PAGE_LIMIT` controls how many pages are shown before "Load more" appears:

```javascript
const DISPLAY_PAGE_LIMIT = 20;
```

### Modify the IndexedDB schema

If you need to change the stores or add fields, increment `DB_VERSION` in `db.js` and add migration logic in the `onupgradeneeded` handler. Existing user databases automatically upgrade on the next visit.

## Testing

There are no automated tests. Testing is manual:

- **Small PDF (2-3 pages):** Verify that pages appear incrementally, stats update, and copy and download produce correct output.
- **Large PDF (20+ pages):** Verify that **Load more** appears, pagination works, and memory stays flat (open **DevTools** > **Memory** > **Heap snapshots**).
- **Force OCR:** Process a PDF with embedded text normally, and then process it again with **Force OCR** selected. Compare the two downloads.
- **Error recovery:** Start processing a large file and close the tab before it finishes. Reopen the app and verify the recovery banner appears and partial download works.
- **Clear:** Process a file, select **Clear**, and verify everything resets (including IndexedDB — check **DevTools** > **Application** > **IndexedDB**).
- **Second file:** Process a large file, and then a small one. Verify no stale UI from the first extraction remains.

## Scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Starts the Vite dev server with hot reload |
| `npm run build` | Creates a production build in `dist/` |
| `npm run preview` | Serves the production build locally for testing |
