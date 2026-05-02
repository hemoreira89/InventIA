// Setup global de testes — roda antes de cada arquivo de teste
import '@testing-library/jest-dom';
import { vi, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup automático após cada teste
afterEach(() => {
  cleanup();
});

// Mock do localStorage (jsdom não tem por padrão em alguns casos)
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: vi.fn(key => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = String(value); }),
    removeItem: vi.fn(key => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn(i => Object.keys(store)[i] || null)
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock do navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn(() => Promise.resolve()) },
  writable: true
});

// Mock do matchMedia
Object.defineProperty(window, 'matchMedia', {
  value: vi.fn(query => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  })),
  writable: true
});
