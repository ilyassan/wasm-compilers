import { useCallback, useRef } from "react";

interface JsOutput {
  type: "output" | "error";
  content: string;
}

export function useJsExecutor() {
  const workerRef = useRef<Worker | null>(null);

  const executeJs = useCallback(async (code: string): Promise<JsOutput[]> => {
    return new Promise((resolve) => {
      // Terminate existing worker if any
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      // Create new worker
      const worker = new Worker("/js-worker.js");
      workerRef.current = worker;

      // Set up timeout (30 seconds)
      const timeout = setTimeout(() => {
        worker.terminate();
        resolve([{
          type: "error",
          content: "Execution timeout: Code took longer than 30 seconds to execute"
        }]);
      }, 30000);

      // Listen for messages from worker
      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        workerRef.current = null;
        resolve(e.data.outputs);
      };

      // Handle worker errors
      worker.onerror = (error) => {
        clearTimeout(timeout);
        worker.terminate();
        workerRef.current = null;
        resolve([{
          type: "error",
          content: `Worker error: ${error.message}`
        }]);
      };

      // Send code to worker
      worker.postMessage({ code });
    });
  }, []);

  return { executeJs };
}
