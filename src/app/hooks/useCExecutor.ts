import { useState, useCallback, useRef, useEffect } from "react";

interface COutput {
  type: "output" | "error" | "info";
  content: string;
}

class WccCompiler {
  private worker: Worker | null = null;
  private messageId = 0;
  private actionHandlerMap = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: unknown) => void }
  >();
  private consoleOut: (text: string, isError: boolean) => void = () => {};
  private isSetup = false;

  async initWorker() {
    if (typeof window === "undefined") return;

    try {
      // Try to fetch worker from CDN first
      const cdnUrl = "https://tyfkda.github.io/xcc/wasi_worker.js";
      let response = await fetch(cdnUrl);

      if (!response.ok) {
        // Fallback to local file
        console.warn("CDN worker fetch failed, using local file");
        response = await fetch("/wcc/wasi_worker.js");
      }

      const workerCode = await response.text();
      const blob = new Blob([workerCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);

      this.worker = new Worker(workerUrl);
      this.worker.onmessage = (event) => {
        const data = event.data;
        if (
          data.messageId != null &&
          this.actionHandlerMap.has(data.messageId)
        ) {
          const handler = this.actionHandlerMap.get(data.messageId)!;
          this.actionHandlerMap.delete(data.messageId);
          if (data.error != null) {
            handler.reject(data.error);
          } else {
            handler.resolve(data.result);
          }
        } else {
          switch (data.action) {
            case "consoleOut":
              this.consoleOut(data.text, data.isError);
              break;
          }
        }
      };
    } catch (error) {
      console.error("Failed to initialize worker:", error);
      throw error;
    }
  }

  setConsoleOutFunction(fn: (text: string, isError: boolean) => void) {
    this.consoleOut = fn;
  }

  async setUp() {
    if (this.isSetup) return;

    // Initialize worker from CDN first
    await this.initWorker();

    const wasm = "wasm";
    const home = `/home/${wasm}`;

    await this.setEnv({
      HOME: home,
      INCLUDE: "/usr/include",
      LIB: "/usr/lib",
      PATH: "/usr/bin",
      PWD: home,
      USER: wasm,
    });

    const options = { recursive: true };
    await this.mkdir("/tmp", options);
    await this.mkdir(home, options);

    // Fetch and extract wccfiles.zip from GitHub Pages CDN
    // This reduces server load and provides faster global delivery
    const cdnUrl = "https://tyfkda.github.io/xcc/wccfiles.zip";
    const localUrl = "/wcc/wccfiles.zip";

    let response = await fetch(cdnUrl);
    if (!response.ok) {
      // Fallback to local files if CDN fails
      console.warn("CDN fetch failed, using local files");
      response = await fetch(localUrl);
      if (!response.ok) {
        throw new Error("Failed to load C compiler");
      }
    }

    const zipData = await response.arrayBuffer();
    const files = await this.unzipFiles(new Uint8Array(zipData));

    let hasCompiler = false;
    for (const [path, content] of Object.entries(files)) {
      if (content == null || content.byteLength === 0) continue;
      const filePath = `/${path}`;
      await this.mkdir(this.dirname(filePath), options);
      await this.writeFile(filePath, content);
      if (filePath === "/usr/bin/cc") {
        hasCompiler = true;
      }
    }

    if (!hasCompiler) {
      throw new Error("C compiler not found in the zip file");
    }

    await this.chdir(home);
    this.isSetup = true;
  }

  private dirname(path: string): string {
    const parts = path.split("/");
    parts.pop();
    return parts.join("/") || "/";
  }

  private async unzipFiles(
    data: Uint8Array
  ): Promise<Record<string, Uint8Array>> {
    // Use fflate library for unzipping (same as the original implementation)
    const { unzip } = await import("fflate");
    return new Promise((resolve, reject) => {
      unzip(data, (err, files) => {
        if (err) reject(err);
        else resolve(files as Record<string, Uint8Array>);
      });
    });
  }

  async writeFile(path: string, content: Uint8Array) {
    await this.postMessage("writeFile", {
      filePath: this.abspath(path),
      content,
    });
  }

  async readFile(path: string): Promise<Uint8Array> {
    return (await this.postMessage("readFile", {
      filePath: this.abspath(path),
    })) as Uint8Array;
  }

  async chdir(path: string) {
    return this.postMessage("chdir", { filePath: this.abspath(path) });
  }

  async mkdir(path: string, options?: { recursive?: boolean }) {
    return this.postMessage("mkdir", {
      filePath: this.abspath(path),
      option: options,
    });
  }

  async setEnv(env: Record<string, string>) {
    return this.postMessage("setEnv", { envJson: JSON.stringify(env) });
  }

  async compile(sourceFile: string, args?: string[]) {
    const compilerArgs = ["/usr/bin/cc"];
    if (args) {
      compilerArgs.push(...args);
    }
    compilerArgs.push(sourceFile);
    return this.runWasi(compilerArgs[0], compilerArgs);
  }

  async runWasi(filePath: string, args: string[]): Promise<number> {
    return (await this.postMessage("runWasi", { filePath, args })) as number;
  }

  async clearTemporaries() {
    const files = (await this.postMessage("readdir", { filePath: "/tmp" })) as string[];
    await Promise.all(
      files.map((file: string) =>
        this.postMessage("unlink", { filePath: `/tmp/${file}` })
      )
    );
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

  private abspath(path: string): string {
    return path[0] === "/" ? path : `/home/wasm/${path}`;
  }

  terminate() {
    this.worker?.terminate();
  }
}

export function useCExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const compilerRef = useRef<WccCompiler | null>(null);
  const isInitializing = useRef(false);

  // Lazy initialization - only when needed
  const initCompiler = useCallback(async () => {
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
      compilerRef.current = new WccCompiler();
      await compilerRef.current.setUp();
      setIsInitialized(true);
    } catch (error) {
      console.error("Failed to initialize WCC compiler:", error);
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
      compilerRef.current?.terminate();
    };
  }, []);

  const executeC = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void
    ): Promise<COutput[]> => {
      const outputs: COutput[] = [];

      try {
        // Initialize compiler if not already initialized
        if (!compilerRef.current) {
          onLoadProgress?.(10, "Initializing C compiler");
          await initCompiler();
        }

        // After initialization, check if compiler is ready
        if (!compilerRef.current) {
          outputs.push({
            type: "error",
            content: "C compiler failed to initialize",
          });
          return outputs;
        }

        setIsLoading(true);
        onLoadProgress?.(100, "WCC compiler ready");

        const compiler = compilerRef.current;

        // Set up console output capture
        const consoleOutputs: string[] = [];
        compiler.setConsoleOutFunction((text: string, isError: boolean) => {
          if (isError) {
            outputs.push({ type: "error", content: text });
          } else {
            consoleOutputs.push(text);
          }
        });

        onProgress?.("Compiling C code...", "info");

        // Write source code to file
        const sourceFile = "/tmp/main.c";
        const outputFile = "/tmp/a.wasm";
        await compiler.writeFile(
          sourceFile,
          new TextEncoder().encode(code)
        );

        // Compile the code
        try {
          await compiler.compile(sourceFile, ["-o", outputFile]);
        } catch (error) {
          // Compilation errors are captured in consoleOutputs
          if (outputs.length === 0 && consoleOutputs.length === 0) {
            outputs.push({
              type: "error",
              content:
                error instanceof Error ? error.message : "Compilation failed",
            });
          }
          return outputs;
        }

        onProgress?.("Running compiled code...", "info");

        // Run the compiled WebAssembly
        try {
          await compiler.runWasi(outputFile, [outputFile]);

          // Add captured console output
          if (consoleOutputs.length > 0) {
            outputs.push({
              type: "output",
              content: consoleOutputs.join("\n"),
            });
          } else if (outputs.length === 0) {
            outputs.push({
              type: "output",
              content: "(program completed successfully)",
            });
          }
        } catch (error) {
          if (outputs.length === 0) {
            outputs.push({
              type: "error",
              content:
                error instanceof Error
                  ? error.message
                  : "Runtime error occurred",
            });
          }
        }

        // Clean up temporary files
        await compiler.clearTemporaries();

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
    [initCompiler]
  );

  return { executeC, isLoading, isInitialized };
}
