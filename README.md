# Document Text Extractor

A client-side web application that extracts text from PDF and DOCX files using Tesseract.js, PDF.js, and Mammoth.js. All processing happens in the browser - no server required.

## Features

- Drag and drop or click to upload PDF and DOCX files
- Client-side processing - completely private, no data sent to servers
- Live progress tracking with visual progress bar
- PDF preview - see thumbnail previews of your PDF pages
- Integrity verification - compare OCR results with embedded text for PDFs
- Copy to clipboard - easily copy extracted text
- Download as TXT - save extracted text with verification report
- Statistics - character count, word count, page count
- Multi-language support - Hebrew and English OCR for PDFs

## Technologies Used

- **Tesseract.js v5** - JavaScript OCR engine for PDFs
- **PDF.js v3** - Mozilla's PDF rendering library
- **Mammoth.js v1.6** - DOCX text extraction library
- **Vite v5** - Fast build tool and dev server

## Setup

### Prerequisites

- Node.js 16+ and npm installed

### Installation

```bash
cd PDFOCR
npm install
npm run dev
```

Open your browser and go to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

### Run Tests

```bash
npm test
```

## How to Use

1. **Upload a Document**: Click the upload area or drag and drop a PDF or DOCX file (max 25MB)
2. **Preview**: View thumbnail previews of your PDF pages (DOCX files display file info only)
3. **Process**: Click "Start OCR Processing" to extract text
4. **View Results**: See extracted text with statistics and verification report
5. **Export**: Copy to clipboard or download as TXT file with verification data

## Performance Notes

- **PDF Processing time**: Depends on size and complexity (typically 2-5 seconds per page with OCR)
- **DOCX Processing time**: Near-instant text extraction (no OCR needed)
- **File size limit**: 25MB maximum for both PDF and DOCX
- **Languages**: Hebrew and English OCR support for PDFs
- **Browser compatibility**: Works on modern browsers (Chrome, Firefox, Safari, Edge)

## OCR Accuracy Tips

For best OCR results:
- Use high-quality scanned PDFs
- Ensure text is clear and legible
- Avoid heavily skewed or rotated text
- Use PDFs with good contrast between text and background

## Customization

### Add More Languages

Edit `src/processing.js` and change the language code in `extractTextFromPdf`:

```javascript
const worker = await createWorker(['eng']); // Change to desired languages
```

Supported languages: eng, fra, deu, spa, chi_sim, and [many more](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html)

### Adjust OCR Quality

Modify `PDF_RENDER_SCALE` in `src/config.js` (higher = better quality but slower):

```javascript
PDF_RENDER_SCALE: 3.0  // Default; increase for better quality
```

## File Structure

```
PDFOCR/
  index.html           Main HTML file
  main.js              Entry point - imports and initialization
  src/
    config.js          Configuration constants
    state.js           Application state
    utils.js           Shared utilities (progress, stats, formatting)
    upload.js          File upload handling (drag-drop, validation)
    preview.js         PDF page preview rendering
    processing.js      OCR and DOCX text extraction
    verification.js    Integrity verification display
    results.js         Copy, download, clear handlers
  tests/
    utils.test.js      Unit tests for pure functions
  package.json         Dependencies
  vite.config.js       Vite configuration
```

## Privacy and Security

- All processing happens in your browser
- No data is sent to external servers
- Files are processed locally using Web Workers
- Safe for sensitive documents

## License

MIT License
