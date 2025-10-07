import { useState, useCallback, useRef } from "react";

interface JavaOutput {
  type: "output" | "error" | "info";
  content: string;
}

const loadCheerpJScript = async (): Promise<void> => {
  if (typeof window === "undefined") return;

  // Check if already loaded
  if (typeof cheerpjInit !== "undefined") {
    return;
  }

  // Dynamically load the CheerpJ script
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cjrtnc.leaningtech.com/4.2/loader.js";
    script.async = true;

    script.onload = () => {
      // Wait a bit for cheerpjInit to become available
      const checkInterval = setInterval(() => {
        if (typeof cheerpjInit !== "undefined") {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (typeof cheerpjInit !== "undefined") {
          resolve();
        } else {
          reject(new Error("CheerpJ initialization timeout"));
        }
      }, 10000);
    };

    script.onerror = () => {
      reject(new Error("Failed to load CheerpJ script"));
    };

    document.head.appendChild(script);
  });
};

export function useJavaExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isNativeReady, setIsNativeReady] = useState(false);
  const isInitialized = useRef(false);
  const isLoadingCheerpJ = useRef(false);

  const loadCheerpJ = useCallback(async () => {
    // If already initialized or loading, return
    if (isInitialized.current || isLoadingCheerpJ.current) return;

    isLoadingCheerpJ.current = true;
    console.log("Starting to load CheerpJ...");

    try {
      // Dynamically load CheerpJ script
      await loadCheerpJScript();
      console.log("CheerpJ script loaded, initializing...");

      // Initialize CheerpJ with status: 'none' to suppress output
      await cheerpjInit({
        status: "none",
      });

      console.log("CheerpJ initialized, running dummy code to trigger asset download...");

      // Run a simple dummy Java code to trigger all asset downloads
      const dummyCode = `public class Dummy {
    public static void main(String[] args) {
        System.out.println("init");
    }
}`;

      const consoleElement = document.createElement("pre");
      consoleElement.id = "console-dummy";
      consoleElement.style.position = "fixed";
      consoleElement.style.left = "-9999px";
      document.body.appendChild(consoleElement);

      try {
        cheerpOSAddStringFile("/str/Dummy.java", dummyCode);
        await cheerpjRunMain(
          "com.sun.tools.javac.Main",
          "/app/tools.jar:/files/",
          "/str/Dummy.java",
          "-d",
          "/files/"
        );
        await cheerpjRunMain("Dummy", "/app/tools.jar:/files/");
        console.log("Dummy execution complete, all assets downloaded");
      } finally {
        if (consoleElement.parentNode) {
          consoleElement.parentNode.removeChild(consoleElement);
        }
      }

      console.log("CheerpJ fully initialized and ready");
      isInitialized.current = true;
      setIsNativeReady(true);
    } catch (error) {
      console.warn("Failed to load CheerpJ, will continue using API:", error);
      isLoadingCheerpJ.current = false;
    }
  }, []);

  const executeJavaAPI = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      filename?: string
    ): Promise<JavaOutput[]> => {
      const outputs: JavaOutput[] = [];

      try {
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
      }
    },
    []
  );

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

  const executeJavaNative = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void
    ): Promise<JavaOutput[]> => {
      const outputs: JavaOutput[] = [];

      try {
        const mainClass = deriveMainClass(code);
        const fileName = mainClass.includes(".")
          ? mainClass.split(".").pop()! + ".java"
          : mainClass + ".java";

        // Create console and output elements
        let consoleElement = document.getElementById("console") as HTMLPreElement | null;
        let outputElement = document.getElementById("output") as HTMLDivElement | null;
        const cleanupElements: HTMLElement[] = [];

        if (!consoleElement) {
          consoleElement = document.createElement("pre");
          consoleElement.id = "console";
          consoleElement.style.position = "fixed";
          consoleElement.style.left = "-9999px";
          consoleElement.style.top = "-9999px";
          document.body.appendChild(consoleElement);
          cleanupElements.push(consoleElement);
        } else {
          consoleElement.innerHTML = "";
        }

        if (!outputElement) {
          outputElement = document.createElement("div");
          outputElement.id = "output";
          outputElement.style.position = "fixed";
          outputElement.style.left = "-9999px";
          outputElement.style.top = "-9999px";
          document.body.appendChild(outputElement);
          cleanupElements.push(outputElement);
        } else {
          outputElement.innerHTML = "";
        }

        try {
          cheerpOSAddStringFile(`/str/${fileName}`, code);

          onProgress?.(`Compiling ${fileName}...`, "info");

          const classPath = "/app/tools.jar:/files/";
          const sourceFile = `/str/${fileName}`;

          const compileCode = await cheerpjRunMain(
            "com.sun.tools.javac.Main",
            classPath,
            sourceFile,
            "-d",
            "/files/"
          );

          const compileOutput = consoleElement.innerText || "";

          if (compileCode !== 0) {
            outputs.push({
              type: "error",
              content: compileOutput || "Compilation failed",
            });
          } else {
            consoleElement.innerHTML = "";

            onProgress?.(`Running ${mainClass}...`, "info");
            const runCode = await cheerpjRunMain(mainClass, classPath);

            const runtimeOutput = consoleElement.innerText || "";
            const displayOutput = outputElement.innerText || "";

            const allOutput = [runtimeOutput, displayOutput]
              .filter((o) => o.trim())
              .join("\n");

            if (allOutput) {
              outputs.push({
                type: "output",
                content: allOutput,
              });
            } else {
              outputs.push({
                type: "output",
                content: "(no output)",
              });
            }

            if (runCode !== 0) {
              outputs.push({
                type: "info",
                content: `Program exited with code ${runCode}`,
              });
            }
          }

          cleanupElements.forEach((el) => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });

          return outputs;
        } catch (error) {
          cleanupElements.forEach((el) => {
            if (el.parentNode) {
              el.parentNode.removeChild(el);
            }
          });

          const errorMessage = error instanceof Error ? error.message : String(error);
          outputs.push({
            type: "error",
            content: `Java execution error: ${errorMessage}`,
          });
          return outputs;
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        outputs.push({
          type: "error",
          content: `Java Error: ${errorMessage}`,
        });
        return outputs;
      }
    },
    []
  );

  const executeJava = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void,
      filename?: string
    ): Promise<JavaOutput[]> => {
      try {
        setIsLoading(true);

        // Start loading CheerpJ in background on first run (if not already loaded/loading)
        if (!isNativeReady && !isLoadingCheerpJ.current) {
          console.log("First Java run - triggering CheerpJ download in background");
          loadCheerpJ(); // Fire and forget - runs in background
        }

        // Always report 100% - no loading indicators for hybrid approach
        onLoadProgress?.(100, "Java runtime ready");

        // ONLY use native if BOTH flags confirm it's fully ready
        if (isNativeReady && isInitialized.current) {
          console.log("Using browser execution");
          return await executeJavaNative(code, onProgress);
        } else {
          console.log("Using API execution", { isNativeReady, isInitialized: isInitialized.current, isLoading: isLoadingCheerpJ.current });
          // Use API while downloading or if native failed to load
          return await executeJavaAPI(code, onProgress, filename);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [isNativeReady, executeJavaNative, executeJavaAPI, loadCheerpJ]
  );

  return { executeJava, isLoading };
}
