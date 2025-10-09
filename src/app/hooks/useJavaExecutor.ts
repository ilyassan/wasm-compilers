import { useState, useCallback, useRef, useEffect } from "react";

interface JavaOutput {
  type: "output" | "error" | "info";
  content: string;
}

class TeaVMWorker {
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
      const workerUrl = "/teavm/teavm.worker.js";
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

    onProgress?.(10, "Initializing Java runtime");

    // Initialize worker
    await this.initWorker();

    onProgress?.(30, "Loading TeaVM compiler");

    // Initialize TeaVM in the worker
    await this.postMessage("init", {});

    onProgress?.(100, "Java runtime ready");

    this.isSetup = true;
  }

  async compileAndExecute(
    code: string,
    mainClass: string,
    fileName: string
  ): Promise<{ success: boolean; output?: string; errors?: string }> {
    const result = (await this.postMessage("compileAndExecute", {
      code,
      mainClass,
      fileName,
    })) as { success: boolean; output?: string; errors?: string; error?: string };

    // Normalize the result
    if (!result.success && result.error) {
      return { success: false, errors: result.error };
    }

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

export function useJavaExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const workerRef = useRef<TeaVMWorker | null>(null);
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
      workerRef.current = new TeaVMWorker();
      await workerRef.current.setUp(onLoadProgress);
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize TeaVM worker:", error);
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

  const executeJava = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void
    ): Promise<JavaOutput[]> => {
      const outputs: JavaOutput[] = [];

      // Helper function to derive main class name
      const deriveMainClass = (code: string): string => {
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        if (classMatch && classMatch[1]) {
          const className = classMatch[1];
          const packageMatch = code.match(/package\s+(.+);/);
          if (packageMatch && packageMatch[1]) {
            const packageName = packageMatch[1].trim();
            return `${packageName}.${className}`;
          }
          return className;
        }
        return "Main";
      };

      try {
        // Initialize worker if not already initialized
        if (!workerRef.current) {
          onLoadProgress?.(5, "Initializing Java compiler");
          await initWorker(onLoadProgress);
        }

        // After initialization, check if worker is ready
        if (!workerRef.current) {
          outputs.push({
            type: "error",
            content: "Java compiler failed to initialize",
          });
          return outputs;
        }

        setIsLoading(true);
        onLoadProgress?.(100, "Java runtime ready");

        const worker = workerRef.current;
        const mainClass = deriveMainClass(code);
        const fileName = mainClass.includes(".")
          ? mainClass.split(".").pop()! + ".java"
          : mainClass + ".java";

        onProgress?.(`Compiling ${fileName}...`, "info");

        // Compile and execute in the worker (off main thread!)
        const result = await worker.compileAndExecute(code, mainClass, fileName);

        if (!result.success) {
          outputs.push({
            type: "error",
            content: result.errors || "Compilation failed",
          });
          return outputs;
        }

        onProgress?.(`Running ${mainClass}...`, "info");

        if (result.output) {
          outputs.push({
            type: "output",
            content: result.output,
          });
        } else {
          outputs.push({
            type: "output",
            content: "(no output)",
          });
        }

        return outputs;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        outputs.push({
          type: "error",
          content: `Java execution error: ${errorMessage}`,
        });
        return outputs;
      } finally {
        setIsLoading(false);
      }
    },
    [initWorker]
  );

  return { executeJava, isLoading, isInitialized };
}
