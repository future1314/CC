// Test script to check filesApi.ts syntax
try {
  await import('./src/services/api/filesApi.ts');
  console.log('✓ filesApi.ts imported successfully');
} catch (error) {
  console.error('✗ Error importing filesApi.ts:', error.message);
  console.error(error.stack);
}