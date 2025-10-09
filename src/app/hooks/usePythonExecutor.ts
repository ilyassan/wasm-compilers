import { useState, useCallback, useRef, useEffect } from "react";

interface PythonOutput {
  type: "output" | "error" | "info" | "image";
  content: string;
}

class PyodideWorker {
  private worker: Worker | null = null;
  private messageId = 0;
  private actionHandlerMap = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();
  private isSetup = false;

  async initWorker() {
    if (typeof window === "undefined") return;

    try {
      // Create worker from the public directory
      const workerUrl = "/python.worker.js";
      this.worker = new Worker(workerUrl);

      this.worker.onmessage = (event) => {
        const data = event.data;

        // Handle ready message
        if (data.action === "ready") {
          return;
        }

        if (data.messageId != null && this.actionHandlerMap.has(data.messageId)) {
          const handler = this.actionHandlerMap.get(data.messageId)!;
          this.actionHandlerMap.delete(data.messageId);
          if (data.error != null) {
            handler.reject(new Error(data.error));
          } else {
            handler.resolve(data.result);
          }
        }
      };

      this.worker.onerror = (error) => {
        console.error("Worker error:", error);
      };
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      throw error;
    }
  }

  async setUp(onProgress?: (progress: number, message: string) => void) {
    if (this.isSetup) return;

    onProgress?.(5, "Downloading Python runtime");

    // Initialize worker
    await this.initWorker();

    onProgress?.(30, "Initializing Pyodide");

    // Initialize Pyodide in the worker
    await this.postMessage("init", {});

    onProgress?.(100, "Python runtime ready");

    this.isSetup = true;
  }

  async execute(code: string, imports?: string[]): Promise<{ success: boolean; outputs?: PythonOutput[]; error?: string }> {
    const result = (await this.postMessage("execute", {
      code,
      imports,
    })) as { success: boolean; outputs?: PythonOutput[]; error?: string };

    return result;
  }

  private postMessage(action: string, params: Record<string, unknown> = {}): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const messageId = ++this.messageId;
      this.actionHandlerMap.set(messageId, { resolve, reject });
      params.action = action;
      params.messageId = messageId;
      this.worker?.postMessage(params);
    });
  }

  terminate() {
    this.worker?.terminate();
  }
}

export function usePythonExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const workerRef = useRef<PyodideWorker | null>(null);
  const isInitializing = useRef(false);

  // Lazy initialization - only when needed
  const initWorker = useCallback(async (onLoadProgress?: (progress: number, message: string) => void) => {
    if (typeof window === "undefined") return;

    // If already initialized or initializing, return
    if (isInitialized || isInitializing.current) {
      // Wait for initialization to complete if in progress
      if (isInitializing.current && !isInitialized) {
        await new Promise<void>((resolve) => {
          const checkInterval = setInterval(() => {
            if (isInitialized || !isInitializing.current) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
        });
      }
      return;
    }

    isInitializing.current = true;

    try {
      setIsLoading(true);
      workerRef.current = new PyodideWorker();
      await workerRef.current.setUp(onLoadProgress);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize Pyodide worker:", error);
      isInitializing.current = false;
      throw error;
    } finally {
      setIsLoading(false);
      isInitializing.current = false;
    }
  }, [isInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const executePython = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void
    ): Promise<PythonOutput[]> => {
      // Helper function to extract import statements
      const extractImports = (code: string): string[] => {
        const imports: string[] = [];
        const lines = code.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();

          // Match: import package
          // Match: import package as alias
          // Match: from package import ...
          const importMatch = trimmed.match(/^import\s+(\w+)/);
          const fromMatch = trimmed.match(/^from\s+(\w+)\s+import/);

          if (importMatch) {
            imports.push(importMatch[1]);
          } else if (fromMatch) {
            imports.push(fromMatch[1]);
          }
        }

        return [...new Set(imports)]; // Remove duplicates
      };

      try {
        // Initialize worker if not already initialized
        if (!workerRef.current) {
          onLoadProgress?.(5, "Initializing Python runtime");
          await initWorker(onLoadProgress);
        }

        // After initialization, check if worker is ready
        if (!workerRef.current) {
          return [{
            type: "error",
            content: "Python runtime failed to initialize",
          }];
        }

        setIsLoading(true);
        onLoadProgress?.(100, "Python runtime ready");

        const worker = workerRef.current;

        // Extract imports from code
        const imports = extractImports(code);

        // Execute in the worker (off main thread!)
        const result = await worker.execute(code, imports);

        if (!result.success) {
          return [{
            type: "error",
            content: result.error || "Python execution failed",
          }];
        }

        // Call progress callbacks for package installations (if any)
        if (result.outputs) {
          result.outputs.forEach(output => {
            if (output.type === "info" || output.type === "error") {
              onProgress?.(output.content, output.type);
            }
          });
        }

        return result.outputs || [];
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return [{
          type: "error",
          content: `Python Error: ${errorMessage}`,
        }];
      } finally {
        setIsLoading(false);
      }
    },
    [initWorker]
  );

  return { executePython, isLoading, isInitialized };
}
