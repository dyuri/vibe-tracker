/**
 * Health check utilities for E2E tests
 */

export interface HealthCheckOptions {
  url: string;
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
}

/**
 * Wait for a service to be healthy by polling its health endpoint
 */
export async function waitForHealthy(options: HealthCheckOptions): Promise<boolean> {
  const { url, maxRetries = 30, retryDelay = 2000, timeout = 5000 } = options;

  console.log(`🏥 Waiting for service to be healthy: ${url}`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`✅ Service is healthy after ${attempt} attempt(s)`);
        return true;
      }

      console.log(
        `⏳ Health check attempt ${attempt}/${maxRetries} failed with status: ${response.status}`
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⏳ Health check attempt ${attempt}/${maxRetries} failed: ${errorMessage}`);
    }

    if (attempt < maxRetries) {
      console.log(`⏰ Waiting ${retryDelay}ms before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  console.error(`❌ Service failed to become healthy after ${maxRetries} attempts`);
  return false;
}

/**
 * Check if a service is currently healthy (single check, no retries)
 */
export async function isHealthy(url: string, timeout: number = 5000): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    return false;
  }
}
