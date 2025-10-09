import { useState, useCallback, useRef, useEffect } from "react";

interface PhpOutput {
  type: "output" | "error";
  content: string;
}

class PhpWorker {
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
      const workerUrl = "/php.worker.js";
      this.worker = new Worker(workerUrl, { type: "module" });

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

    onProgress?.(5, "Downloading PHP WASM");

    // Initialize worker
    await this.initWorker();

    onProgress?.(30, "Loading PHP runtime");

    // Initialize PHP in the worker
    await this.postMessage("init", {});

    onProgress?.(100, "PHP runtime ready");

    this.isSetup = true;
  }

  async execute(code: string): Promise<{ success: boolean; outputs?: PhpOutput[]; error?: string }> {
    const result = (await this.postMessage("execute", {
      code,
    })) as { success: boolean; outputs?: PhpOutput[]; error?: string };

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

export function usePhpExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const workerRef = useRef<PhpWorker | null>(null);
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
      workerRef.current = new PhpWorker();
      await workerRef.current.setUp(onLoadProgress);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize PHP worker:", error);
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

  const executePhp = useCallback(async (
    code: string,
    onLoadProgress?: (progress: number, message: string) => void
  ): Promise<PhpOutput[]> => {
    try {
      // Initialize worker if not already initialized
      if (!workerRef.current) {
        onLoadProgress?.(5, "Initializing PHP runtime");
        await initWorker(onLoadProgress);
      }

      // After initialization, check if worker is ready
      if (!workerRef.current) {
        return [{
          type: "error",
          content: "PHP runtime failed to initialize",
        }];
      }

      setIsLoading(true);
      onLoadProgress?.(100, "PHP runtime ready");

      const worker = workerRef.current;

      // Execute in the worker (off main thread!)
      const result = await worker.execute(code);

      if (!result.success) {
        return [{
          type: "error",
          content: result.error || "PHP execution failed",
        }];
      }

      return result.outputs || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return [{
        type: "error",
        content: `PHP Error: ${errorMessage}`,
      }];
    } finally {
      setIsLoading(false);
    }
  }, [initWorker]);

  return { executePhp, isLoading, isInitialized };
}
