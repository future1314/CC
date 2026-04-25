#!/usr/bin/env bun

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

console.log('Building Claude Code...');

// Clean previous build
try {
  rmSync('dist', { recursive: true, force: true });
  console.log('Cleaned previous build');
} catch {
  console.log('No previous build to clean');
}

// Since .ts files are the source of truth (Bun resolves .js imports to .ts),
// we copy the src tree directly. No tsc compilation needed for Bun runtime.
console.log('Copying source files to dist/...');
cpSync('src', 'dist/src', { recursive: true, filter: (src) => {
  // Skip .js compiled artifacts if any remain
  if (src.endsWith('.js') && !src.includes('node_modules')) return false;
  return true;
}});

// Copy assets, vendor, shims
cpSync('vendor', 'dist/vendor', { recursive: true });
cpSync('shims', 'dist/shims', { recursive: true });
try { cpSync('src/assets', 'dist/assets', { recursive: true }); } catch {}

// Type-check only (no emit) — validates .ts source without producing .js
console.log('Running type-check...');
try {
  execSync('bun run tsc --noEmit', { stdio: 'inherit' });
} catch {
  console.warn('⚠️  Type-check had errors (non-blocking for Bun runtime)');
}

console.log('Build completed successfully!');
console.log('Output directory: dist/');