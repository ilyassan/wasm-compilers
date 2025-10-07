import { useState, useCallback, useRef } from "react";

interface PythonOutput {
  type: "output" | "error" | "info" | "image";
  content: string;
}

// Pyodide types
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  globals: {
    get: (name: string) => unknown;
  };
  FS: {
    readFile: (path: string, options: { encoding: string }) => string;
    writeFile: (path: string, data: string) => void;
  };
}

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<PyodideInterface>;
    pyodide?: PyodideInterface;
  }
}

// List of supported Pyodide packages
const SUPPORTED_PACKAGES = [
  'numpy', 'scipy', 'pandas', 'matplotlib', 'scikit-learn', 'scikit-image',
  'networkx', 'sympy', 'pillow', 'regex', 'pyyaml', 'requests', 'beautifulsoup4',
  'micropip', 'packaging', 'cryptography', 'pytz', 'sqlite3', 'lxml', 'html5lib',
  'pytest', 'setuptools', 'wheel', 'statsmodels', 'seaborn', 'xarray', 'zarr',
  'plotly', 'bokeh', 'opencv-python', 'sqlalchemy', 'wordcloud', 'pygments',
  'jedi', 'pyodide-http', 'bitarray', 'msgpack', 'openpyxl', 'xlrd'
];

export function usePythonExecutor() {
  const [isLoading, setIsLoading] = useState(false);
  const pyodideRef = useRef<PyodideInterface | null>(null);
  const isLoadingPyodide = useRef(false);
  const loadedPackages = useRef<Set<string>>(new Set());

  // Function to extract import statements from Python code
  const extractImports = useCallback((code: string): string[] => {
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
  }, []);

  // Function to validate and load required packages
  const loadPackages = useCallback(async (
    packages: string[],
    pyodide: PyodideInterface,
    onProgress?: (message: string, type: "info" | "error") => void
  ): Promise<void> => {
    // Filter out already loaded packages
    const packagesToLoad = packages.filter(pkg => !loadedPackages.current.has(pkg));

    if (packagesToLoad.length === 0) {
      return;
    }

    for (const pkg of packagesToLoad) {
      // Check if package is supported
      if (!SUPPORTED_PACKAGES.includes(pkg)) {
        onProgress?.(`⚠ Package "${pkg}" is not supported by Pyodide`, "error");
        continue;
      }

      try {
        // Show installing message immediately
        onProgress?.(`Installing ${pkg}...`, "info");
        await pyodide.loadPackage(pkg);
        loadedPackages.current.add(pkg);
        onProgress?.(`✓ ${pkg} installed`, "info");
      } catch (error) {
        onProgress?.(`✗ Failed to install ${pkg}: ${error instanceof Error ? error.message : "Unknown error"}`, "error");
      }
    }
  }, []);

  const loadPyodide = useCallback(async (
    onProgress?: (progress: number, message: string) => void
  ): Promise<PyodideInterface> => {
    // If already loaded, return it
    if (pyodideRef.current) {
      return pyodideRef.current;
    }

    // If currently loading, wait for it
    if (isLoadingPyodide.current) {
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (pyodideRef.current) {
            clearInterval(checkInterval);
            resolve(pyodideRef.current);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          reject(new Error("Pyodide loading timeout"));
        }, 30000);
      });
    }

    isLoadingPyodide.current = true;
    setIsLoading(true);

    try {
      // Load Pyodide from CDN
      onProgress?.(5, "Downloading Python runtime");

      if (!window.loadPyodide) {
        onProgress?.(10, "Loading Pyodide script");
        // Dynamically load Pyodide script
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Failed to load Pyodide"));
          document.head.appendChild(script);
        });
      }

      onProgress?.(30, "Pyodide script loaded");
      onProgress?.(50, "Initializing Python runtime");

      const pyodide = await window.loadPyodide!({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
      });

      onProgress?.(95, "Finalizing setup");

      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100));

      onProgress?.(100, "Python runtime ready");

      pyodideRef.current = pyodide;
      window.pyodide = pyodide;
      return pyodide;
    } catch (error) {
      throw new Error(`Failed to initialize Pyodide: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      isLoadingPyodide.current = false;
      setIsLoading(false);
    }
  }, []);

  const executePython = useCallback(
    async (
      code: string,
      onProgress?: (message: string, type: "info" | "error") => void,
      onLoadProgress?: (progress: number, message: string) => void
    ): Promise<PythonOutput[]> => {
      const outputs: PythonOutput[] = [];

      try {
        setIsLoading(true);

        // Load Pyodide if not already loaded
        const pyodide = await loadPyodide(onLoadProgress);

        // Extract and load required packages
        const imports = extractImports(code);
        if (imports.length > 0) {
          await loadPackages(imports, pyodide, (message, type) => {
            // Call the progress callback if provided (for real-time updates)
            onProgress?.(message, type);
            // Also add to outputs array for final result
            outputs.push({
              type: type === "error" ? "error" : "info",
              content: message,
            });
          });
        }

        // Wrap execution in setTimeout to prevent blocking
        const executeInBackground = () => {
          return new Promise<PythonOutput[]>((resolve) => {
            setTimeout(async () => {
              try {
                // Suppress Pyodide's error handling to prevent console spam
                const originalConsoleError = console.error;
                const originalConsoleWarn = console.warn;
                console.error = (...args) => {
                  // Filter out stackframe loading errors, Pyodide internal errors, and Monaco loader errors
                  const message = args[0]?.toString() || '';
                  const isMonacoError = message.includes('loader.js') || message.includes('[object Event]');
                  const isPyodideError = message.includes('stackframe') || message.includes('Loading') || message.includes('modules that depend') || message.includes('error-stack-parser');

                  if (!isMonacoError && !isPyodideError) {
                    originalConsoleError(...args);
                  }
                };
                console.warn = () => {}; // Suppress warnings during execution

                try {
                  // First, clean up the namespace from previous executions (except built-ins and system modules)
                  const cleanupCode = `
import sys
import builtins

# Get all current globals
_to_delete = []
for _name in list(globals().keys()):
    if not _name.startswith('_') and _name not in dir(builtins) and _name not in sys.modules:
        _to_delete.append(_name)

# Delete user-defined variables from previous runs
for _name in _to_delete:
    try:
        del globals()[_name]
    except:
        pass

# Clean up temporary variables
del _to_delete
if '_name' in globals():
    del _name
`;

                  await pyodide.runPythonAsync(cleanupCode);

                  // Setup matplotlib for browser rendering
                  const setupPlotting = `
import sys
_matplotlib_available = False
_plots_captured = []

# Setup Matplotlib
try:
    import matplotlib
    import matplotlib.pyplot as plt
    from io import BytesIO
    import base64

    # Set the backend to Agg (non-interactive, image generation)
    matplotlib.use('Agg')
    _matplotlib_available = True

    # Override plt.show() to capture plots
    _original_plt_show = plt.show

    def _custom_plt_show(*args, **kwargs):
        global _plots_captured
        # Get all figure numbers
        figures = [plt.figure(num) for num in plt.get_fignums()]

        for fig in figures:
            # Save figure to BytesIO buffer
            buf = BytesIO()
            fig.savefig(buf, format='png', dpi=100, bbox_inches='tight')
            buf.seek(0)

            # Convert to base64
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            _plots_captured.append(img_base64)
            buf.close()

        # Close all figures after capturing
        plt.close('all')

    # Replace plt.show with our custom function
    plt.show = _custom_plt_show

except ImportError:
    pass
`;

                  await pyodide.runPythonAsync(setupPlotting);

                  // Capture stdout and stderr
                  const captureCode = `
import sys
from io import StringIO

# Create string buffers for stdout and stderr
_stdout_buffer = StringIO()
_stderr_buffer = StringIO()

# Redirect stdout and stderr
sys.stdout = _stdout_buffer
sys.stderr = _stderr_buffer

# User code will be executed here
_user_code_result = None
_execution_error = None
try:
${code.split('\n').map(line => `    ${line}`).join('\n')}
except Exception as e:
    import traceback
    _execution_error = traceback.format_exc()

# Get the output
_captured_stdout = _stdout_buffer.getvalue()
_captured_stderr = _stderr_buffer.getvalue()

# Restore stdout and stderr
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`;

                  await pyodide.runPythonAsync(captureCode);

                  // Get captured output
                  const stdout = pyodide.globals.get("_captured_stdout") as string;
                  const stderr = pyodide.globals.get("_captured_stderr") as string;
                  const executionError = pyodide.globals.get("_execution_error") as string | null;
                  const plotsCaptured = pyodide.globals.get("_plots_captured") as string[] | null;

                  if (stdout) {
                    outputs.push({
                      type: "output",
                      content: stdout,
                    });
                  }

                  // Add captured matplotlib plots
                  if (plotsCaptured && plotsCaptured.length > 0) {
                    plotsCaptured.forEach((base64Image: string) => {
                      outputs.push({
                        type: "image",
                        content: base64Image,
                      });
                    });
                  }

                  if (executionError) {
                    outputs.push({
                      type: "error",
                      content: executionError,
                    });
                  } else if (stderr) {
                    outputs.push({
                      type: "error",
                      content: stderr,
                    });
                  }

                  const hasAnyOutput = stdout ||
                                      (plotsCaptured && plotsCaptured.length > 0) ||
                                      executionError ||
                                      stderr;

                  if (!hasAnyOutput) {
                    outputs.push({
                      type: "output",
                      content: "(no output)",
                    });
                  }

                  resolve(outputs);
                } finally {
                  // Restore console methods
                  console.error = originalConsoleError;
                  console.warn = originalConsoleWarn;
                }
              } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                outputs.push({
                  type: "error",
                  content: `Python Error: ${errorMessage}`,
                });
                resolve(outputs);
              }
            }, 0);
          });
        };

        return await executeInBackground();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        outputs.push({
          type: "error",
          content: `Python Error: ${errorMessage}`,
        });
        return outputs;
      } finally {
        setIsLoading(false);
      }
    },
    [loadPyodide, extractImports, loadPackages]
  );

  return { executePython, isLoading };
}
