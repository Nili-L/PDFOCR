# PDF OCR Web Application

A client-side web application that performs OCR (Optical Character Recognition) on PDF files using Tesseract.js and PDF.js. All processing happens in the browser - no server required!

## Features

- 📤 **Drag & drop or click to upload** PDF files
- 🔍 **Client-side OCR processing** - completely private, no data sent to servers
- 📊 **Live progress tracking** with visual progress bar
- 👁️ **PDF preview** - see thumbnail previews of your pages
- 📋 **Copy to clipboard** - easily copy extracted text
- 💾 **Download as TXT** - save extracted text as a text file
- 📈 **Statistics** - character count, word count, page count
- 🎨 **Beautiful UI** - modern, responsive design

## Technologies Used

- **Tesseract.js** - JavaScript OCR engine
- **PDF.js** - Mozilla's PDF rendering library
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

1. **Upload a PDF**: Click the upload area or drag and drop a PDF file (max 1000MB)
2. **Preview**: View thumbnail previews of your PDF pages
3. **Process**: Click "Start OCR Processing" to extract text
4. **View Results**: See extracted text with statistics
5. **Export**: Copy to clipboard or download as TXT file

## Performance Notes

- **Processing time**: Depends on PDF size and complexity (typically 2-5 seconds per page)
- **File size limit**: 1000MB (1GB) maximum
- **Languages**: Currently supports English (can be extended to other languages)
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

### Issue: Can't upload PDF
- **Solution**: Ensure file is under 1000MB and is a valid PDF format.

## Privacy & Security

- All processing happens in your browser
- No data is sent to external servers
- Files are processed locally using Web Workers
- Safe for sensitive documents

## License

MIT License - feel free to use and modify as needed.

## Contributing

Contributions welcome! Feel free to submit issues or pull requests.
