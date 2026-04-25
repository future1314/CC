#!/usr/bin/env bun

import { execSync } from 'node:child_process';

console.log('Building Claude Code...');

// Clean previous build
try {
  execSync('rm -rf dist', { stdio: 'inherit' });
  console.log('Cleaned previous build');
} catch (error) {
  console.log('No previous build to clean');
}

// Run TypeScript compilation
execSync('bun run tsc', { stdio: 'inherit' });

// Copy assets
execSync('cp -r src/assets dist/', { stdio: 'inherit' });
execSync('cp -r vendor dist/', { stdio: 'inherit' });
execSync('cp -r shims dist/', { stdio: 'inherit' });

console.log('Build completed successfully!');
console.log('Output directory: dist/');