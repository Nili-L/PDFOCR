# Document Text Extractor

A client-side web application that extracts text from PDF and DOCX files using Tesseract.js, PDF.js, and Mammoth.js. All processing happens in the browser - no server required!

## Features

- 📤 **Drag & drop or click to upload** PDF and DOCX files
- 🔍 **Client-side processing** - completely private, no data sent to servers
- 📊 **Live progress tracking** with visual progress bar
- 👁️ **PDF preview** - see thumbnail previews of your PDF pages
- ✅ **Integrity verification** - compare OCR results with embedded text for PDFs
- 📋 **Copy to clipboard** - easily copy extracted text
- 💾 **Download as TXT** - save extracted text with verification report
- 📈 **Statistics** - character count, word count, page count
- 🌐 **Multi-language support** - Hebrew and English OCR for PDFs
- 🎨 **Beautiful UI** - modern, responsive design

## Technologies Used

- **Tesseract.js** - JavaScript OCR engine for PDFs
- **PDF.js** - Mozilla's PDF rendering library
- **Mammoth.js** - DOCX text extraction library
- **Vite** - Fast build tool and dev server

## Setup Instructions

### Prerequisites

- Node.js 16+ and npm installed

### Installation

1. Navigate to the project directory:
```bash
cd pdf-ocr-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and go to `http://localhost:5173`

### Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory. You can serve them with any static file server.

## How to Use

1. **Upload a Document**: Click the upload area or drag and drop a PDF or DOCX file (max 500MB)
2. **Preview**: View thumbnail previews of your PDF pages (DOCX files display file info only)
3. **Process**: Click "Start OCR Processing" to extract text
4. **View Results**: See extracted text with statistics and verification report
5. **Export**: Copy to clipboard or download as TXT file with verification data

## Performance Notes

- **PDF Processing time**: Depends on size and complexity (typically 2-5 seconds per page with OCR)
- **DOCX Processing time**: Near-instant text extraction (no OCR needed)
- **File size limit**: 500MB maximum for both PDF and DOCX
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

Edit `main.js` and change the language code:

```javascript
const worker = await createWorker('eng'); // Change 'eng' to desired language
```

Supported languages: eng, fra, deu, spa, chi_sim, and [many more](https://tesseract-ocr.github.io/tessdoc/Data-Files-in-different-versions.html)

### Adjust OCR Quality

Modify the viewport scale for better accuracy (higher = better quality but slower):

```javascript
const viewport = page.getViewport({ scale: 2.0 }); // Increase for better quality
```

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support
- Mobile browsers: ✅ Supported (with performance considerations)

## File Structure

```
pdf-ocr-app/
├── index.html          # Main HTML file
├── main.js             # OCR processing logic
├── package.json        # Dependencies
├── README.md           # Documentation
└── vite.config.js      # Vite configuration (auto-generated)
```

## Troubleshooting

### Issue: OCR is slow
- **Solution**: Processing is resource-intensive. Try smaller PDFs or fewer pages at a time.

### Issue: Low accuracy
- **Solution**: Increase the viewport scale in `main.js` (line 137) from 2.0 to 3.0 or higher.

### Issue: Can't upload file
- **Solution**: Ensure file is under 500MB and is a valid PDF or DOCX format.

## Privacy & Security

- All processing happens in your browser
- No data is sent to external servers
- Files are processed locally using Web Workers
- Safe for sensitive documents

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions welcome! Feel free to submit issues or pull requests.
