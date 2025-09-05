import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting Playwright E2E test environment cleanup...');

  try {
    // Stop any remaining Go processes (if any leaked)
    await killGoProcesses();

    // Clean up test database
    await cleanupTestDatabase();

    // Clean up temporary files
    await cleanupTempFiles();

    console.log('✅ Global teardown completed successfully');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here - we want tests to complete even if cleanup fails
    console.warn('⚠️  Continuing despite cleanup errors...');
  }
}

async function killGoProcesses() {
  console.log('🔄 Cleaning up any remaining Go processes...');

  try {
    // Kill any Go processes that might be running from tests
    // This is a safety measure in case the webServer didn't clean up properly
    if (process.platform !== 'win32') {
      // On Unix-like systems
      try {
        execSync('pkill -f "go run . serve"', { stdio: 'pipe' });
        console.log('✅ Killed remaining Go processes');
      } catch (error) {
        // It's okay if no processes were found to kill
        console.log('ℹ️  No Go processes found to clean up');
      }
    }
  } catch (error) {
    console.warn('⚠️  Could not clean up Go processes:', error);
  }
}

async function cleanupTestDatabase() {
  console.log('🗄️  Cleaning up test database...');

  const testDbPath = 'tests-e2e/fixtures/test.db';

  try {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
      console.log('✅ Test database removed');
    }

    // Also clean up any database-related temp files
    const dbTempFiles = ['tests-e2e/fixtures/test.db-shm', 'tests-e2e/fixtures/test.db-wal'];

    dbTempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`✅ Removed ${file}`);
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not clean up test database:', error);
  }
}

async function cleanupTempFiles() {
  console.log('📁 Cleaning up temporary test files...');

  try {
    // Remove any temporary files that might have been created during tests
    const tempPatterns = [
      'test-results/temp-*',
      'tests/fixtures/temp-*',
      'playwright-report/temp-*',
    ];

    // Note: In a real implementation, you might want to use a proper glob library
    // For now, we'll just clean up known temp files
    const tempFiles = ['tests-e2e/fixtures/temp.db', 'test-results/temp-storage-state.json'];

    tempFiles.forEach(file => {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
        console.log(`✅ Removed temporary file: ${file}`);
      }
    });
  } catch (error) {
    console.warn('⚠️  Could not clean up temporary files:', error);
  }
}

export default globalTeardown;
