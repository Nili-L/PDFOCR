import { describe, it, expect } from 'vitest';
import { formatFileSize } from '../src/utils.js';
import { isTextReadable } from '../src/processing.js';
import { createComparisonResult } from '../src/processing.js';
import { CONFIG } from '../src/config.js';

describe('formatFileSize', () => {
    it('returns "0 Bytes" for 0', () => {
        expect(formatFileSize(0)).toBe('0 Bytes');
    });

    it('formats bytes correctly', () => {
        expect(formatFileSize(500)).toBe('500 Bytes');
    });

    it('formats kilobytes correctly', () => {
        expect(formatFileSize(1024)).toBe('1 KB');
        expect(formatFileSize(1536)).toBe('1.5 KB');
    });

    it('formats megabytes correctly', () => {
        expect(formatFileSize(1048576)).toBe('1 MB');
        expect(formatFileSize(2621440)).toBe('2.5 MB');
    });

    it('formats gigabytes correctly', () => {
        expect(formatFileSize(1073741824)).toBe('1 GB');
    });
});

describe('isTextReadable', () => {
    it('returns true for English text', () => {
        expect(isTextReadable('Hello world, this is a readable text document.')).toBe(true);
    });

    it('returns true for Hebrew text', () => {
        expect(isTextReadable('\u05E9\u05DC\u05D5\u05DD \u05E2\u05D5\u05DC\u05DD \u05D6\u05D4 \u05D8\u05E7\u05E1\u05D8 \u05E7\u05E8\u05D9\u05D0')).toBe(true);
    });

    it('returns true for mixed Hebrew and English', () => {
        expect(isTextReadable('Hello \u05E9\u05DC\u05D5\u05DD world \u05E2\u05D5\u05DC\u05DD')).toBe(true);
    });

    it('returns false for garbled text', () => {
        expect(isTextReadable('\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD\uFFFD')).toBe(false);
    });

    it('returns true for text with numbers', () => {
        expect(isTextReadable('Order 12345 was placed on 2024-01-15')).toBe(true);
    });

    it('returns true for empty text', () => {
        expect(isTextReadable('')).toBe(true);
    });
});

describe('createComparisonResult', () => {
    it('creates result with correct structure', () => {
        const result = createComparisonResult(true, 95, 'Test message');
        expect(result).toEqual({
            hasEmbeddedText: true,
            similarity: 95,
            criticalErrors: [],
            structuralDifferences: [],
            textAccuracyIssues: [],
            semanticIntegrity: 'Test message',
            overallAssessment: 'Test message'
        });
    });

    it('creates result for no embedded text', () => {
        const result = createComparisonResult(false, 100, 'OCR only');
        expect(result.hasEmbeddedText).toBe(false);
        expect(result.similarity).toBe(100);
    });
});

describe('CONFIG', () => {
    it('has correct file size limit', () => {
        expect(CONFIG.MAX_FILE_SIZE_MB).toBe(25);
    });

    it('has preview page limit', () => {
        expect(CONFIG.MAX_PREVIEW_PAGES).toBe(5);
    });

    it('has render scale', () => {
        expect(CONFIG.PDF_RENDER_SCALE).toBe(3.0);
    });

    it('has similarity thresholds in descending order', () => {
        expect(CONFIG.SIMILARITY_THRESHOLDS.EXCELLENT).toBeGreaterThan(CONFIG.SIMILARITY_THRESHOLDS.GOOD);
        expect(CONFIG.SIMILARITY_THRESHOLDS.GOOD).toBeGreaterThan(CONFIG.SIMILARITY_THRESHOLDS.FAIR);
    });
});
