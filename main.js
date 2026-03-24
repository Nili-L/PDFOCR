import { state } from './src/state.js';
import { updateProgress, updateStatistics } from './src/utils.js';
import { initUpload } from './src/upload.js';
import { extractTextFromDocx, extractTextFromPdf, extractEmbeddedText, isTextReadable, createComparisonResult } from './src/processing.js';
import { displayVerificationResults } from './src/verification.js';
import { initResults } from './src/results.js';

// Initialize upload and result handlers
initUpload();
initResults();

// Process Document (PDF or DOCX)
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const progressContainer = document.getElementById('progressContainer');
const resultText = document.getElementById('resultText');
const statsContainer = document.getElementById('statsContainer');
const actionButtons = document.getElementById('actionButtons');

processBtn.addEventListener('click', async () => {
    if (!state.currentFile) return;

    processBtn.disabled = true;
    clearBtn.disabled = true;
    progressContainer.classList.add('active');

    try {
        if (state.currentFileType === 'docx') {
            updateProgress(50, 'Extracting text from DOCX...');

            state.extractedText = await extractTextFromDocx(state.currentFile);
            state.embeddedText = state.extractedText;

            updateProgress(100, 'Complete!');

            state.comparisonResult = createComparisonResult(
                true, 100, 'Text extracted directly from document (100% accuracy)'
            );

            resultText.textContent = state.extractedText || 'No text extracted';
            updateStatistics(state.extractedText);

        } else {
            if (!state.currentPdf) throw new Error('PDF failed to load. Please try re-uploading the file.');

            updateProgress(30, 'Extracting embedded text...');

            state.embeddedText = await extractEmbeddedText(state.currentPdf);

            const hasGoodEmbeddedText = state.embeddedText &&
                                       state.embeddedText.trim().length > 100 &&
                                       isTextReadable(state.embeddedText);

            if (hasGoodEmbeddedText) {
                updateProgress(100, 'Using embedded text (100% accuracy)...');
                state.extractedText = state.embeddedText;

                state.comparisonResult = createComparisonResult(
                    true, 100, 'Text extracted directly from PDF (100% accuracy)'
                );
            } else {
                updateProgress(50, 'Embedded text is garbled - performing OCR...');
                state.extractedText = await extractTextFromPdf(state.currentPdf);

                updateProgress(100, 'OCR complete');

                state.comparisonResult = createComparisonResult(
                    false, 100, 'OCR extraction complete - embedded text was garbled/unreadable'
                );
            }

            resultText.textContent = state.extractedText || 'No text extracted';
            updateStatistics(state.extractedText, state.currentPdf.numPages);
        }

        statsContainer.style.display = 'flex';
        actionButtons.style.display = 'flex';

        displayVerificationResults(state.comparisonResult);

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
