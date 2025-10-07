import { useState, useCallback } from "react";

interface COutput {
  type: "output" | "error" | "info";
  content: string;
}

export function useCExecutor() {
  const [isLoading, setIsLoading] = useState(false);

  const executeC = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void
    ): Promise<COutput[]> => {
      const outputs: COutput[] = [];

      try {
        setIsLoading(true);

        onProgress?.(`Compiling C code...`, "info");

        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language: "c",
            version: "10.2.0",
            files: [
              {
                name: "main.c",
                content: code,
              },
            ],
          }),
        });

        if (!response.ok) {
          throw new Error("Compilation service unavailable. Please try again.");
        }

        const result = await response.json();

        if (result.compile && result.compile.stderr) {
          outputs.push({
            type: "error",
            content: result.compile.stderr,
          });
          return outputs;
        }

        onProgress?.(`Running program...`, "info");

        if (result.run) {
          if (result.run.stdout) {
            outputs.push({
              type: "output",
              content: result.run.stdout,
            });
          }

          if (result.run.stderr) {
            outputs.push({
              type: "error",
              content: result.run.stderr,
            });
          }

          if (!result.run.stdout && !result.run.stderr) {
            outputs.push({
              type: "output",
              content: "(no output)",
            });
          }
        }

        return outputs;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        outputs.push({
          type: "error",
          content: `C compilation error: ${errorMessage}`,
        });
        return outputs;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { executeC, isLoading };
}
