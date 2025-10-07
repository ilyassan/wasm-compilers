import { useState, useCallback, useRef } from "react";
import type { PhpWebConstructor, PhpWebInstance } from "@/types/php-wasm";

interface PhpOutput {
  type: "output" | "error";
  content: string;
}

// Dynamically load and wait for php-wasm from CDN
const waitForPhpWasm = async (
  onProgress?: (progress: number, message: string) => void
): Promise<PhpWebConstructor | null> => {
  if (typeof window === "undefined") return null;

  // Check if already loaded
  if (window.PhpWebClass) {
    return window.PhpWebClass;
  }

  onProgress?.(5, "Downloading PHP WASM");
  onProgress?.(15, "Loading PHP runtime");

  // Dynamically load the PHP WASM module using Function constructor to avoid build-time resolution
  return Promise.race([
    new Promise<PhpWebConstructor>(async (resolve, reject) => {
      try {
        // Use Function constructor to create dynamic import that won't be analyzed at build time
        const dynamicImport = new Function('url', 'return import(url)');
        const phpModule = await dynamicImport('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs');
        window.PhpWebClass = phpModule.PhpWeb;

        if (window.PhpWebClass) {
          onProgress?.(60, "PHP WASM loaded");
          // Small delay to show progress
          await new Promise(r => setTimeout(r, 100));
          onProgress?.(100, "PHP runtime ready");
          resolve(window.PhpWebClass);
        } else {
          reject(new Error('PhpWeb class not available after loading'));
        }
      } catch (error) {
        reject(new Error(`Failed to load PHP WASM: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    }),
    new Promise<PhpWebConstructor>((_, reject) =>
      setTimeout(() => reject(new Error('PHP WASM loading timeout. Please refresh the page.')), 30000)
    )
  ]);
};

export function usePhpExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const phpInstanceRef = useRef<PhpWebInstance | null>(null);
  const executionPromiseRef = useRef<Promise<PhpOutput[]> | null>(null);

  const executePhp = useCallback(async (
    code: string,
    onLoadProgress?: (progress: number, message: string) => void
  ): Promise<PhpOutput[]> => {
    // If there's already an execution in progress, wait for it or return
    if (executionPromiseRef.current) {
      return executionPromiseRef.current;
    }

    const executeAsync = async (): Promise<PhpOutput[]> => {
      const outputs: PhpOutput[] = [];

      try {
        setIsLoading(true);

        // Wait for PHP WASM to load and initialize
        if (!phpInstanceRef.current) {
          const PhpWeb = await waitForPhpWasm(onLoadProgress);
          if (!PhpWeb) {
            throw new Error("PHP runtime not available");
          }

          // Create PHP instance and wait for it to initialize
          const php = new PhpWeb();

          // Wait for WASM to be ready - PhpWeb emits 'ready' event when initialized
          if (typeof php.addEventListener !== 'function') {
            await Promise.race([
              new Promise<void>((resolve) => {
                // Poll for addEventListener existence (indicates WASM loaded)
                const interval = setInterval(() => {
                  if (typeof php.addEventListener === 'function') {
                    clearInterval(interval);
                    resolve();
                  }
                }, 50);
              }),
              new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('WASM initialization timeout')), 10000)
              )
            ]);
          }

          phpInstanceRef.current = php;
        }

        const php = phpInstanceRef.current;

        // Wrap execution in a promise that can be run asynchronously
        const executeInBackground = () => {
          return new Promise<PhpOutput[]>((resolve, reject) => {
            // Use setTimeout to defer execution and prevent blocking
            setTimeout(async () => {
              try {
                // Capture output using event listeners
                const outputLines: string[] = [];
                const errorLines: string[] = [];

                // Set up output listeners
                const handleOutput = (event: CustomEvent<string>) => {
                  if (event.detail) {
                    outputLines.push(event.detail);
                  }
                };

                const handleError = (event: CustomEvent<string>) => {
                  if (event.detail) {
                    errorLines.push(event.detail);
                  }
                };

                php.addEventListener('output', handleOutput);
                php.addEventListener('error', handleError);

                try {
                  // Refresh PHP instance to clear previous state (prevents redeclaration errors)
                  if (php.refresh) {
                    php.refresh();
                  }

                  // Run PHP code - output is captured via event listeners
                  await php.run(code);

                  // Clean up listeners immediately (output is already captured)
                  php.removeEventListener('output', handleOutput);
                  php.removeEventListener('error', handleError);

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

                  resolve(outputs);
                } catch (runError) {
                  php.removeEventListener('output', handleOutput);
                  php.removeEventListener('error', handleError);
                  reject(runError);
                }
              } catch (error) {
                reject(error);
              }
            }, 0);
          });
        };

        return await executeInBackground();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        outputs.push({
          type: "error",
          content: `PHP Error: ${errorMessage}`,
        });
        return outputs;
      } finally {
        setIsLoading(false);
        executionPromiseRef.current = null;
      }
    };

    executionPromiseRef.current = executeAsync();
    return executionPromiseRef.current;
  }, []);

  return { executePhp, isLoading };
}
