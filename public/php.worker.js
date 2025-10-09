// PHP Web Worker for off-thread PHP execution
// This worker handles php-wasm initialization and PHP code execution
// without blocking the main UI thread

let phpInstance = null;

const PHP_WASM_CDN = 'https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs';

// Message handler
self.onmessage = async (event) => {
  const { action, messageId, ...params } = event.data;

  try {
    let result;

    switch (action) {
      case 'init':
        result = await initPhp();
        break;

      case 'execute':
        result = await executePhp(params.code);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    self.postMessage({ messageId, result });
  } catch (error) {
    self.postMessage({
      messageId,
      error: error.message || 'Unknown error occurred',
      stack: error.stack
    });
  }
};

// Initialize PHP WASM
async function initPhp() {
  if (phpInstance) {
    return { status: 'already_initialized' };
  }

  try {
    // Dynamically import the PHP WASM module
    const phpModule = await import(PHP_WASM_CDN);
    const PhpWeb = phpModule.PhpWeb;

    if (!PhpWeb) {
      throw new Error('PhpWeb class not available after loading');
    }

    // Create PHP instance
    phpInstance = new PhpWeb();

    // Wait for WASM to be ready
    if (typeof phpInstance.addEventListener !== 'function') {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('WASM initialization timeout')), 10000);

        // Poll for addEventListener existence (indicates WASM loaded)
        const interval = setInterval(() => {
          if (typeof phpInstance.addEventListener === 'function') {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve();
          }
        }, 50);
      });
    }

    return { status: 'initialized' };
  } catch (error) {
    throw new Error(`Failed to initialize PHP WASM: ${error.message}`);
  }
}

// Execute PHP code
async function executePhp(code) {
  if (!phpInstance) {
    throw new Error('PHP runtime not initialized');
  }

  const outputs = [];

  try {
    const outputLines = [];
    const errorLines = [];

    // Set up output listeners
    const handleOutput = (event) => {
      if (event.detail) {
        outputLines.push(event.detail);
      }
    };

    const handleError = (event) => {
      if (event.detail) {
        errorLines.push(event.detail);
      }
    };

    phpInstance.addEventListener('output', handleOutput);
    phpInstance.addEventListener('error', handleError);

    try {
      // Refresh PHP instance to clear previous state (prevents redeclaration errors)
      if (phpInstance.refresh) {
        phpInstance.refresh();
      }

      // Run PHP code
      await phpInstance.run(code);

      // Clean up listeners
      phpInstance.removeEventListener('output', handleOutput);
      phpInstance.removeEventListener('error', handleError);

      // Add outputs
      if (outputLines.length > 0) {
        outputs.push({
          type: "output",
          content: outputLines.join(''),
        });
      }

      if (errorLines.length > 0) {
        outputs.push({
          type: "error",
          content: errorLines.join(''),
        });
      }

      if (outputLines.length === 0 && errorLines.length === 0) {
        outputs.push({
          type: "output",
          content: "(no output)",
        });
      }

      return { success: true, outputs };
    } catch (runError) {
      phpInstance.removeEventListener('output', handleOutput);
      phpInstance.removeEventListener('error', handleError);
      throw runError;
    }
  } catch (error) {
    return {
      success: false,
      error: error.message || 'PHP execution failed'
    };
  }
}

// Signal that worker is ready
self.postMessage({ action: 'ready' });
