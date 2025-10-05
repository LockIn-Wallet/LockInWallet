// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfills for Solana libraries in Jest environment
import { TextEncoder, TextDecoder } from 'util';

// Add browser APIs that Solana needs
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Add crypto polyfill
if (typeof global.crypto === 'undefined') {
  const { webcrypto } = require('crypto');
  global.crypto = webcrypto;
}

// Add fetch polyfill for Solana RPC calls
if (typeof global.fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

// Console log for test debugging
console.log('🧪 Test environment setup complete with Solana polyfills');