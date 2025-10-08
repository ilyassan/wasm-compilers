import { useState, useCallback, useRef } from "react";

interface JavaOutput {
  type: "output" | "error" | "info";
  content: string;
}

const TEAVM_BASE_URL = "/teavm";

const loadTeaVMRuntime = async (): Promise<NonNullable<Window["teavmCompiler"]>> => {
  if (typeof window === "undefined") {
    throw new Error("TeaVM can only run in browser environment");
  }

  // Check if already loaded
  if (window.teavmCompiler) {
    return window.teavmCompiler;
  }

  // Load the TeaVM compiler WASM runtime using script tag
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.type = "module";
    script.textContent = `
      import { load } from "${TEAVM_BASE_URL}/compiler.wasm-runtime.js";

      (async function() {
        try {
          const teavm = await load("${TEAVM_BASE_URL}/compiler.wasm", {
            stackDeobfuscator: {
              enabled: true
            }
          });

          window.teavmCompiler = teavm;
          window.dispatchEvent(new CustomEvent('teavm-loaded'));
        } catch (error) {
          console.error("TeaVM load error:", error);
          window.dispatchEvent(new CustomEvent('teavm-error', { detail: error }));
        }
      })();
    `;

    const handleLoad = () => {
      window.removeEventListener('teavm-loaded', handleLoad);
      window.removeEventListener('teavm-error', handleError as EventListener);
      if (!window.teavmCompiler) {
        reject(new Error("TeaVM compiler not found after loading"));
        return;
      }
      resolve(window.teavmCompiler);
    };

    const handleError = (event: Event) => {
      window.removeEventListener('teavm-loaded', handleLoad);
      window.removeEventListener('teavm-error', handleError as EventListener);
      const customEvent = event as CustomEvent;
      reject(customEvent.detail || new Error("Failed to load TeaVM runtime"));
    };

    window.addEventListener('teavm-loaded', handleLoad);
    window.addEventListener('teavm-error', handleError as EventListener);

    document.head.appendChild(script);
  });
};

export function useJavaExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isNativeReady, setIsNativeReady] = useState(false);
  const isInitialized = useRef(false);
  const isLoadingCheerpJ = useRef(false);

  const loadTeaVM = useCallback(async () => {
    // If already initialized or loading, return
    if (isInitialized.current || isLoadingCheerpJ.current) return;

    isLoadingCheerpJ.current = true;
    console.log("Starting to load TeaVM...");

    try {
      // Load TeaVM compiler WASM runtime
      const teavmCompiler = await loadTeaVMRuntime();
      console.log("TeaVM runtime loaded successfully");

      // Store the TeaVM compiler instance for later use
      if (!window.teavmCompiler) {
        window.teavmCompiler = teavmCompiler;
      }

      console.log("TeaVM fully initialized and ready");
      isInitialized.current = true;
      setIsNativeReady(true);
    } catch (error) {
      console.warn("Failed to load TeaVM, will continue using API:", error);
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
      let stdoutBuffer = "";

      try {
        const mainClass = deriveMainClass(code);
        const fileName = mainClass.includes(".")
          ? mainClass.split(".").pop()! + ".java"
          : mainClass + ".java";

        onProgress?.(`Compiling ${fileName}...`, "info");

        // Get TeaVM compiler instance
        const teavmModule = window.teavmCompiler;
        if (!teavmModule) {
          throw new Error("TeaVM compiler not initialized");
        }

        const compilerLib = teavmModule.exports;
        const compiler = compilerLib.createCompiler();

        // Load classlibs (they should be cached after first load)
        const [sdkData, teavmClasslibData] = await Promise.all([
          fetch(`${TEAVM_BASE_URL}/compile-classlib-teavm.bin`).then((r) =>
            r.arrayBuffer()
          ),
          fetch(`${TEAVM_BASE_URL}/runtime-classlib-teavm.bin`).then((r) =>
            r.arrayBuffer()
          ),
        ]);

        compiler.setSdk(new Int8Array(sdkData));
        compiler.setTeaVMClasslib(new Int8Array(teavmClasslibData));

        // Add source file
        compiler.addSourceFile(fileName, code);

        // Collect diagnostics
        const diagnostics: string[] = [];
        compiler.onDiagnostic((diagnostic: Parameters<Parameters<ReturnType<NonNullable<Window["teavmCompiler"]>["exports"]["createCompiler"]>["onDiagnostic"]>[0]>[0]) => {
          if (diagnostic.severity === "ERROR") {
            diagnostics.push(`${diagnostic.message}`);
          }
        });

        // Compile
        const compileSuccess = compiler.compile();

        if (!compileSuccess || diagnostics.length > 0) {
          outputs.push({
            type: "error",
            content: diagnostics.join("\n") || "Compilation failed",
          });
          return outputs;
        }

        onProgress?.(`Running ${mainClass}...`, "info");

        // Generate WebAssembly
        compiler.generateWebAssembly({
          outputName: "app",
          mainClass: mainClass,
        });

        // Get the generated WASM file
        const generatedWasm = compiler.getWebAssemblyOutputFile("app.wasm");

        // Load and run the generated WASM using the runtime loader
        const outputTeavm = await new Promise<NonNullable<Window["teavmCompiler"]>>((resolve, reject) => {
          const script = document.createElement("script");
          script.type = "module";
          script.textContent = `
            import { load } from "${TEAVM_BASE_URL}/compiler.wasm-runtime.js";

            (async function() {
              try {
                const wasmBytes = new Uint8Array([${Array.from(generatedWasm).join(',')}]);
                const teavm = await load(wasmBytes, {
                  stackDeobfuscator: { enabled: false }
                });
                window.__teavmOutput = teavm;
                window.dispatchEvent(new CustomEvent('teavm-output-loaded'));
              } catch (error) {
                window.dispatchEvent(new CustomEvent('teavm-output-error', { detail: error }));
              }
            })();
          `;

          const handleLoad = () => {
            window.removeEventListener('teavm-output-loaded', handleLoad);
            window.removeEventListener('teavm-output-error', handleError as EventListener);
            const output = (window as Window & { __teavmOutput?: NonNullable<Window["teavmCompiler"]> }).__teavmOutput;
            if (!output) {
              reject(new Error("TeaVM output not found after loading"));
              return;
            }
            resolve(output);
            delete (window as Window & { __teavmOutput?: NonNullable<Window["teavmCompiler"]> }).__teavmOutput;
          };

          const handleError = (event: Event) => {
            window.removeEventListener('teavm-output-loaded', handleLoad);
            window.removeEventListener('teavm-output-error', handleError as EventListener);
            const customEvent = event as CustomEvent;
            reject(customEvent.detail || new Error("Failed to load output WASM"));
          };

          window.addEventListener('teavm-output-loaded', handleLoad);
          window.addEventListener('teavm-output-error', handleError as EventListener);

          document.head.appendChild(script);
        });

        // Capture stdout
        const originalConsoleLog = console.log;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        console.log = (...args: any[]) => {
          stdoutBuffer += args.join(" ") + "\n";
        };

        try {
          // Run main method
          await outputTeavm.exports.main([]);
        } finally {
          console.log = originalConsoleLog;
        }

        if (stdoutBuffer) {
          outputs.push({
            type: "output",
            content: stdoutBuffer.trim(),
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

        // Start loading TeaVM in background on first run (if not already loaded/loading)
        if (!isNativeReady && !isLoadingCheerpJ.current) {
          console.log("First Java run - triggering TeaVM download in background");
          loadTeaVM(); // Fire and forget - runs in background
        }

        // Always report 100% - no loading indicators for hybrid approach
        onLoadProgress?.(100, "Java runtime ready");

        // ONLY use native if BOTH flags confirm it's fully ready
        if (isNativeReady && isInitialized.current) {
          console.log("Using TeaVM browser execution");
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
    [isNativeReady, executeJavaNative, executeJavaAPI, loadTeaVM]
  );

  return { executeJava, isLoading };
}
