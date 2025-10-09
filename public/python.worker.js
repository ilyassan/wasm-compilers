// Python (Pyodide) Web Worker for off-thread Python execution
// This worker handles Pyodide initialization and Python code execution
// without blocking the main UI thread

let pyodide = null;
let loadedPackages = new Set();

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full';

// List of supported Pyodide packages
const SUPPORTED_PACKAGES = [
  'numpy', 'scipy', 'pandas', 'matplotlib', 'scikit-learn', 'scikit-image',
  'networkx', 'sympy', 'pillow', 'regex', 'pyyaml', 'requests', 'beautifulsoup4',
  'micropip', 'packaging', 'cryptography', 'pytz', 'sqlite3', 'lxml', 'html5lib',
  'pytest', 'setuptools', 'wheel', 'statsmodels', 'seaborn', 'xarray', 'zarr',
  'plotly', 'bokeh', 'opencv-python', 'sqlalchemy', 'wordcloud', 'pygments',
  'jedi', 'pyodide-http', 'bitarray', 'msgpack', 'openpyxl', 'xlrd'
];

// Message handler
self.onmessage = async (event) => {
  const { action, messageId, ...params } = event.data;

  try {
    let result;

    switch (action) {
      case 'init':
        result = await initPyodide();
        break;

      case 'execute':
        result = await executePython(params.code, params.imports);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    self.postMessage({ messageId, result });
  } catch (error) {
    self.postMessage({
      messageId,
      error: error.message || 'Unknown error occurred',
      stack: error.stack
    });
  }
};

// Initialize Pyodide
async function initPyodide() {
  if (pyodide) {
    return { status: 'already_initialized' };
  }

  try {
    // Load Pyodide script
    importScripts(`${PYODIDE_CDN}/pyodide.js`);

    // Initialize Pyodide
    pyodide = await loadPyodide({
      indexURL: PYODIDE_CDN
    });

    return { status: 'initialized' };
  } catch (error) {
    throw new Error(`Failed to initialize Pyodide: ${error.message}`);
  }
}

// Extract import statements from Python code
function extractImports(code) {
  const imports = [];
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
}

// Load required packages
async function loadPackages(packages) {
  const packageMessages = [];

  // Filter out already loaded packages
  const packagesToLoad = packages.filter(pkg => !loadedPackages.has(pkg));

  if (packagesToLoad.length === 0) {
    return packageMessages;
  }

  for (const pkg of packagesToLoad) {
    // Check if package is supported
    if (!SUPPORTED_PACKAGES.includes(pkg)) {
      packageMessages.push({
        type: 'error',
        content: `⚠ Package "${pkg}" is not supported by Pyodide`
      });
      continue;
    }

    try {
      packageMessages.push({
        type: 'info',
        content: `Installing ${pkg}...`
      });

      await pyodide.loadPackage(pkg);
      loadedPackages.add(pkg);

      packageMessages.push({
        type: 'info',
        content: `✓ ${pkg} installed`
      });
    } catch (error) {
      packageMessages.push({
        type: 'error',
        content: `✗ Failed to install ${pkg}: ${error.message}`
      });
    }
  }

  return packageMessages;
}

// Execute Python code
async function executePython(code, imports = null) {
  if (!pyodide) {
    throw new Error('Pyodide not initialized');
  }

  const outputs = [];

  try {
    // Extract and load required packages
    const detectedImports = imports || extractImports(code);
    if (detectedImports.length > 0) {
      const packageMessages = await loadPackages(detectedImports);
      outputs.push(...packageMessages);
    }

    // Clean up namespace from previous executions
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
    const stdout = pyodide.globals.get("_captured_stdout");
    const stderr = pyodide.globals.get("_captured_stderr");
    const executionError = pyodide.globals.get("_execution_error");
    const plotsCaptured = pyodide.globals.get("_plots_captured");

    if (stdout) {
      outputs.push({
        type: "output",
        content: stdout,
      });
    }

    // Add captured matplotlib plots
    if (plotsCaptured && plotsCaptured.length > 0) {
      plotsCaptured.forEach((base64Image) => {
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

    return { success: true, outputs };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Python execution failed'
    };
  }
}

// Signal that worker is ready
self.postMessage({ action: 'ready' });
