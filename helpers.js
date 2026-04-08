// helpers.js — Pure utility functions, extracted for testability

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

export function isTextReadable(text) {
    const cleanText = text.replace(/[\s\-_]+/g, '');

    const hebrewChars = (cleanText.match(/[\u0590-\u05FF]/g) || []).length;
    const latinChars = (cleanText.match(/[a-zA-Z]/g) || []).length;
    const numbers = (cleanText.match(/[0-9]/g) || []).length;

    const recognizable = hebrewChars + latinChars + numbers;

    if (cleanText.length > 0 && recognizable / cleanText.length < 0.5) {
        return false;
    }

    return true;
}

export function createExtractionSummary(method, message) {
    return { method, message };
}
