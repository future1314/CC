// Try to import just the module without executing it
try {
  const module = await import('./src/services/api/filesApi.js');
  console.log('Import successful');
} catch (error) {
  console.error('Import failed:', error.message);
  console.error('Stack:', error.stack);
}