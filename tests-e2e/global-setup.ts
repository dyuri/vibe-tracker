import { FullConfig } from '@playwright/test';
import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { waitForHealthy } from './helpers/health-check';

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

    // Verify test environment if environment variables are provided
    await verifyTestEnvironment();

    console.log('✅ Global setup completed successfully');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
}

async function prepareTestDatabase() {
  console.log('🗄️  Preparing test database...');

  const templateDbPath = 'tests-e2e/fixtures/template.db';
  const testDbPath = 'tests-e2e/fixtures/data.db'; // PocketBase uses data.db by default

  try {
    // Create template database if it doesn't exist
    if (!fs.existsSync(templateDbPath)) {
      console.log('📝 Creating template database...');

      // Start Go server briefly to create initial DB structure
      console.log('🔄 Initializing database schema...');

      // Use --dir flag to specify directory where data.db will be created
      // Then rename it to template.db
      const tempDir = 'tests-e2e/fixtures/temp-init';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const initProcess = execSync(`timeout 10s go run . serve --dir=${tempDir} || true`, {
        env: {
          ...process.env,
          TEST_MODE: 'true',
          ENABLE_RATE_LIMITING: 'false',
        },
        cwd: process.cwd(),
      });

      // Wait a moment for DB to be created
      await new Promise(resolve => setTimeout(resolve, 2000));

      const tempDbPath = path.join(tempDir, 'data.db');
      if (fs.existsSync(tempDbPath)) {
        // Move the created data.db to template.db
        fs.copyFileSync(tempDbPath, templateDbPath);
        // Clean up temp directory
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('✅ Template database created');
      } else {
        throw new Error('Failed to create template database');
      }
    }

    // Copy template to test database (data.db)
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

async function verifyTestEnvironment() {
  const testEmail = process.env.TEST_EMAIL;
  const testPassword = process.env.TEST_PASSWORD;

  if (!testEmail || !testPassword) {
    console.log('⚠️  No test credentials provided, skipping test environment verification');
    return;
  }

  console.log('👤 Verifying test environment...');

  // Start the server temporarily to verify the test environment
  const serverProcess = spawn('go', ['run', '.', 'serve', '--dir=tests-e2e/fixtures'], {
    stdio: 'pipe',
    detached: false,
    env: {
      ...process.env,
      TEST_MODE: 'true',
      ENABLE_RATE_LIMITING: 'false',
    },
  });

  try {
    // Wait for server to be ready - try health endpoint first, fall back to root
    const healthCheckResult = await waitForHealthy({
      url: 'http://localhost:8090/health/live',
      maxRetries: 10,
      retryDelay: 1000,
      timeout: 3000,
    });

    if (!healthCheckResult) {
      console.log('🔄 Health endpoint not available, trying root endpoint...');
      await waitForHealthy({
        url: 'http://localhost:8090/',
        maxRetries: 5,
        retryDelay: 1000,
        timeout: 3000,
      });
    }
    console.log('🚀 Server started for environment verification');

    // Wait a bit more for server to fully initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test database is pre-populated with test user via manual setup
    // No need to create users programmatically anymore!
    console.log('✅ Using pre-populated test database with test user');
  } catch (error) {
    console.log(`⚠️  Error verifying test environment: ${error}`);
  } finally {
    // Stop the server
    serverProcess.kill('SIGTERM');
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for cleanup
    console.log('🛑 Server stopped after environment verification');
  }
}

export default globalSetup;
