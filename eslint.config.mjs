import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'work/**', 'test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: Object.fromEntries([
        'console', 'process', 'Buffer', 'URL', 'Uint8Array', 'DataView',
        'ArrayBuffer', 'TextEncoder', 'TextDecoder', 'crypto', 'document',
        'window', 'navigator', 'HTMLElement', 'HTMLInputElement',
        'HTMLTextAreaElement', 'HTMLButtonElement', 'HTMLSelectElement',
        'HTMLFormElement', 'setTimeout', 'clearTimeout', 'location',
        'Event', 'PageTransitionEvent', 'MutationObserver', 'performance',
        'isSecureContext', 'innerWidth', 'localStorage', 'sessionStorage', 'getComputedStyle',
      ].map((name) => [name, 'readonly'])),
    },
  },
];
