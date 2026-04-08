# PDFOCR

A client-side web app that extracts text from PDF and DOCX files. Everything runs in the browser — no server, no uploads, no data leaves your machine.

**Live:** [nili-l.github.io/PDFOCR](https://nili-l.github.io/PDFOCR/)

## How it works

1. Drop a PDF or DOCX file onto the page (or click to browse)
2. Click "Start OCR Processing"
3. Pages appear in the results panel as they're extracted
4. Copy the text or download it as a `.txt` file

For PDFs, the app first tries to extract embedded text directly. If that text is garbled or missing (common with scanned documents), it falls back to OCR via Tesseract.js. You can also check "Force OCR" to skip embedded text and compare OCR quality against the original — useful for validating Hebrew extraction accuracy. DOCX files are extracted directly via Mammoth.js, no OCR needed.

## What you get

- **Incremental results** — pages appear one at a time as they're processed, with live character/word/page counts
- **Extraction report** — the downloaded `.txt` file includes the extraction method used and lists any pages that failed
- **PDF preview** — thumbnail previews of the first 5 pages before processing
- **Crash recovery** — if the tab closes mid-extraction, reopen the app to download whatever was saved
- **Paginated display** — large documents show the first 20 pages with a "Load more" button for the rest

## Privacy

All processing happens in your browser using Web Workers. No file data is sent anywhere. Safe for sensitive documents.

## Supported formats

| Format | Method | Languages |
|--------|--------|-----------|
| PDF (with embedded text) | Direct extraction via PDF.js | Any |
| PDF (scanned/image-only) | OCR via Tesseract.js | Hebrew, English |
| DOCX | Direct extraction via Mammoth.js | Any |

No hard file size limit — the browser's available memory is the constraint. The app processes pages one at a time and releases memory after each, so usage stays flat regardless of document length. Results are stored in IndexedDB, not in memory.

> **Note:** The app decides whether embedded PDF text is "garbled" by checking if 50%+ of characters are Hebrew, Latin, or numeric. PDFs in other scripts (Arabic, CJK, etc.) may trigger OCR unnecessarily even when embedded text is fine.

## Run locally

Requires Node.js 16+ and npm.

```bash
git clone https://github.com/Nili-L/PDFOCR.git
cd PDFOCR
npm install
npm run dev
```

Opens at `http://localhost:5173`.

### Build for production

```bash
npm run build
```

Static files go to `dist/`. Serve them with any static file server, or push to main and GitHub Pages deploys automatically.

## OCR tips

- Higher-quality scans produce better results
- Clear, high-contrast text works best
- The app renders pages at 3x scale before OCR — this balances accuracy against speed
- Heavily skewed or rotated text may reduce accuracy
- Use "Force OCR" to compare OCR output against embedded text on the same file

## Customization

### Add OCR languages

In `main.js`, find the `createWorker` call and change the language codes:

```javascript
const worker = await createWorker(['heb', 'eng']);
```

See the [Tesseract language list](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html) for available codes.

### Adjust OCR resolution

Change `PDF_RENDER_SCALE` in the `CONFIG` object at the top of `main.js`:

```javascript
PDF_RENDER_SCALE: 3.0,  // higher = better quality, slower
```

## Tech stack

- [Tesseract.js](https://tesseract.projectnaptha.com/) — browser-based OCR engine
- [PDF.js](https://mozilla.github.io/pdf.js/) — Mozilla's PDF renderer
- [Mammoth.js](https://github.com/mwilliamson/mammoth.js) — DOCX text extraction
- [Vite](https://vitejs.dev/) — build tool and dev server
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — browser-native storage for incremental results and crash recovery

## Documentation

| Guide | Description |
|-------|-------------|
| [Install and Deploy](docs/installation.md#install-and-deploy-pdfocr) | Self-hosting on GitHub Pages, nginx, Apache, Docker, Caddy |
| [Developer Setup](docs/installation.md#developer-setup) | Project structure, code organization, making changes, testing |

## Browser support

Works on modern browsers (Chrome, Firefox, Safari, Edge). Requires Web Workers, Canvas API, and IndexedDB support.

## License

MIT
