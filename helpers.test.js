import { describe, it, expect } from 'vitest';
import { formatFileSize, isTextReadable, createExtractionSummary } from './helpers.js';

describe('formatFileSize', () => {
    it('returns "0 Bytes" for zero', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes', () => {
        expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats kilobytes', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes', () => {
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(5242880)).toBe('5 MB');
    });

    it('formats gigabytes', () => {
        expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    it('rounds to two decimal places', () => {
        expect(formatFileSize(1234567)).toBe('1.18 MB');
    });
});

describe('isTextReadable', () => {
    it('returns true for normal English text', () => {
        expect(isTextReadable('Hello world, this is a readable sentence.')).toBe(true);
    });

    it('returns true for Hebrew text', () => {
        expect(isTextReadable('שלום עולם זה טקסט קריא')).toBe(true);
    });

    it('returns true for mixed Hebrew and English', () => {
        expect(isTextReadable('Hello שלום world עולם 2024')).toBe(true);
    });

    it('returns true for text with numbers', () => {
        expect(isTextReadable('Order 12345 was placed on 2024-01-15')).toBe(true);
    });

    it('returns false for garbled/gibberish text', () => {
        expect(isTextReadable('◆▲●■□△○★☆♦♣♠♥♤♧♡♢')).toBe(false);
    });

    it('returns false for mostly special characters', () => {
        expect(isTextReadable('§©®™℠℗¶⁂⁑⁕⁖⁘⁙⁛⁜⁝⁞')).toBe(false);
    });

    it('returns true for empty string', () => {
        // cleanText.length === 0, so the ratio check is skipped
        expect(isTextReadable('')).toBe(true);
    });

    it('returns true for whitespace-only string', () => {
        // After removing whitespace, cleanText is empty
        expect(isTextReadable('   \n\t  ')).toBe(true);
    });

    it('handles text at the 50% boundary', () => {
        // 3 recognizable + 3 unrecognizable = exactly 50%, should pass
        expect(isTextReadable('abc◆◆◆')).toBe(true);
        // 2 recognizable + 5 unrecognizable = 28%, should fail
        expect(isTextReadable('ab◆◆◆◆◆')).toBe(false);
    });
});

describe('createExtractionSummary', () => {
    it('creates summary with method and message', () => {
        const summary = createExtractionSummary('ocr', 'OCR extraction complete');
        expect(summary).toEqual({ method: 'ocr', message: 'OCR extraction complete' });
    });

    it('creates summary for embedded extraction', () => {
        const summary = createExtractionSummary('embedded', 'Text extracted directly from PDF');
        expect(summary.method).toBe('embedded');
        expect(summary.message).toBe('Text extracted directly from PDF');
    });
});
