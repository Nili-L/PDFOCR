export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function updateProgress(percentage, message) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const statusRegion = document.getElementById('statusAnnouncer');

    progressFill.style.width = `${percentage}%`;
    progressFill.textContent = `${percentage}%`;
    progressFill.setAttribute('aria-valuenow', percentage);
    progressText.textContent = message;

    if (statusRegion) {
        statusRegion.textContent = `${percentage}% - ${message}`;
    }
}

export function updateStatistics(text, pages) {
    const chars = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    document.getElementById('charCount').textContent = chars.toLocaleString();
    document.getElementById('wordCount').textContent = words.toLocaleString();
    document.getElementById('pageCount').textContent = pages || '-';
}
