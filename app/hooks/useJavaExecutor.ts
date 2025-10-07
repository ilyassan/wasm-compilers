import { useState, useCallback } from "react";

interface JavaOutput {
  type: "output" | "error" | "info";
  content: string;
}

export function useJavaExecutor() {
  const [isLoading, setIsLoading] = useState(false);

  const executeJava = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void,
      filename?: string
    ): Promise<JavaOutput[]> => {
      const outputs: JavaOutput[] = [];

      try {
        setIsLoading(true);

        const classMatch = code.match(/public\s+class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : "Main";
        const fileName = filename || `${className}.java`;

        onProgress?.(`Compiling ${fileName}...`, "info");

        const response = await fetch("https://emkc.org/api/v2/piston/execute", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            language: "java",
            version: "15.0.2",
            files: [
              {
                name: fileName,
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

        onProgress?.(`Running ${className}...`, "info");

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
          content: `Java compilation error: ${errorMessage}`,
        });
        return outputs;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return { executeJava, isLoading };
}
