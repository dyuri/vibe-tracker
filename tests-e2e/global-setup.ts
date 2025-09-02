import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Playwright E2E test environment setup...');

  try {
    // Ensure test directories exist
    const testDirs = ['tests-e2e/fixtures', 'tests-e2e/e2e', 'tests-e2e/helpers', 'test-results'];

    testDirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });

    // Prepare test database
    await prepareTestDatabase();

    // Verify Go backend is available
    await verifyGoBackend();

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

async function prepareTestDatabase() {
  console.log('🗄️  Preparing test database...');

  const templateDbPath = 'tests-e2e/fixtures/template.db';
  const testDbPath = 'tests-e2e/fixtures/test.db';

  try {
    // Create template database if it doesn't exist
    if (!fs.existsSync(templateDbPath)) {
      console.log('📝 Creating template database...');

      // Start Go server briefly to create initial DB structure
      console.log('🔄 Initializing database schema...');
      const initProcess = execSync('timeout 10s go run . serve --dev || true', {
        env: {
          ...process.env,
          TEST_MODE: 'true',
          DB_PATH: templateDbPath,
        },
        cwd: process.cwd(),
      });

      // Wait a moment for DB to be created
      await new Promise(resolve => setTimeout(resolve, 2000));

      if (fs.existsSync(templateDbPath)) {
        console.log('✅ Template database created');
      } else {
        throw new Error('Failed to create template database');
      }
    }

    // Copy template to test database
    if (fs.existsSync(templateDbPath)) {
      fs.copyFileSync(templateDbPath, testDbPath);
      console.log('✅ Test database prepared from template');
    } else {
      throw new Error('Template database not found');
    }
  } catch (error) {
    console.error('❌ Database preparation failed:', error);
    throw error;
  }
}

async function verifyGoBackend() {
  console.log('🔍 Verifying Go backend availability...');

  try {
    // Check if Go is installed
    execSync('go version', { stdio: 'pipe' });
    console.log('✅ Go runtime available');

    // Check if main.go exists
    if (!fs.existsSync('main.go')) {
      throw new Error('main.go not found in current directory');
    }
    console.log('✅ Go application found');

    // Verify we can build the application
    console.log('🔧 Verifying Go application builds...');
    execSync('go build -o /tmp/vibe-tracker-test .', { stdio: 'pipe' });
    console.log('✅ Go application builds successfully');

    // Clean up test binary
    if (fs.existsSync('/tmp/vibe-tracker-test')) {
      fs.unlinkSync('/tmp/vibe-tracker-test');
    }
  } catch (error) {
    console.error('❌ Go backend verification failed:', error);
    throw error;
  }
}

export default globalSetup;
