import { CONFIG } from './config.js';
import { loadPdfPreview } from './preview.js';
import { state } from './state.js';
import { formatFileSize } from './utils.js';

const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const processBtn = document.getElementById('processBtn');
const clearBtn = document.getElementById('clearBtn');
const previewContainer = document.getElementById('previewContainer');

export function initUpload() {
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
    });

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', (e) => {
        if (!uploadArea.contains(e.relatedTarget)) {
            uploadArea.classList.remove('dragover');
        }
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
}

async function handleFileSelect(file) {
    if (file.size > CONFIG.MAX_FILE_SIZE_MB * 1024 * 1024) {
        alert(`File size exceeds ${CONFIG.MAX_FILE_SIZE_MB}MB limit`);
        return;
    }

    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        state.currentFileType = 'pdf';
    } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
        state.currentFileType = 'docx';
    } else {
        alert('Please upload a valid PDF or DOCX file');
        return;
    }

    state.currentFile = file;

    fileName.textContent = file.name;
    fileSize.textContent = `Size: ${formatFileSize(file.size)}`;
    fileInfo.classList.add('active');

    processBtn.disabled = false;
    clearBtn.disabled = false;

    if (state.currentFileType === 'pdf') {
        await loadPdfPreview(file);
    } else {
        previewContainer.style.display = 'none';
    }
}
