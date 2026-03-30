# PDFOCR

A client-side web app that extracts text from PDF and DOCX files. Everything runs in the browser — no server, no uploads, no data leaves your machine.

**Live:** [nili-l.github.io/PDFOCR](https://nili-l.github.io/PDFOCR/)

## How it works

1. Drop a PDF or DOCX file onto the page (or click to browse)
2. Click "Start OCR Processing"
3. Copy the extracted text or download it as a `.txt` file

For PDFs, the app first tries to extract embedded text directly. If that text is garbled or missing (common with scanned documents), it falls back to OCR via Tesseract.js. DOCX files are extracted directly — no OCR needed.

## What you get

- **Extracted text** with character count, word count, and page count
- **Integrity verification** — when a PDF has embedded text, the app scores the extraction quality and flags accuracy issues
- **Verification report** included in the downloaded `.txt` file
- **PDF preview** — thumbnail previews of the first 5 pages before processing

## Privacy

All processing happens in your browser using Web Workers. No file data is sent anywhere. Safe for sensitive documents.

## Supported formats

| Format | Method | Languages |
|--------|--------|-----------|
| PDF (with embedded text) | Direct extraction via PDF.js | Any |
| PDF (scanned/image-only) | OCR via Tesseract.js | Hebrew, English |
| DOCX | Direct extraction via Mammoth.js | Any |

No hard file size limit — the browser's available memory is the constraint. Files up to 500MB+ work well on most machines. The app processes pages one at a time and stores results incrementally, so memory usage stays flat regardless of document length.

> **Note:** The app decides whether embedded PDF text is "garbled" by checking if 50%+ of characters are Hebrew, Latin, or numeric. PDFs in other scripts (Arabic, CJK, etc.) may trigger OCR unnecessarily even when embedded text is fine.

> **Large files:** Results are stored in your browser's IndexedDB as each page completes. If the tab crashes mid-extraction, reopen the app to download whatever was saved.

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

## Browser support

Works on modern browsers (Chrome, Firefox, Safari, Edge). Requires Web Workers and Canvas API support.

## License

MIT