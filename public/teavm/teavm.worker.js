// TeaVM Web Worker for off-thread Java compilation and execution
// This worker handles TeaVM initialization, compilation, and code execution
// without blocking the main UI thread

let teavmCompiler = null;
let cachedSdkData = null;
let cachedTeavmClasslibData = null;

const TEAVM_BASE_URL = '/teavm';

// Message handler
self.onmessage = async (event) => {
  const { action, messageId, ...params } = event.data;

  try {
    let result;

    switch (action) {
      case 'init':
        result = await initTeaVM(params.onProgress);
        break;

      case 'compile':
        result = await compileJava(params.code, params.mainClass, params.fileName);
        break;

      case 'execute':
        result = await executeJava(params.wasmBytes, params.mainClass);
        break;

      case 'compileAndExecute':
        result = await compileAndExecuteJava(params.code, params.mainClass, params.fileName);
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

// Initialize TeaVM compiler
async function initTeaVM() {
  if (teavmCompiler) {
    return { status: 'already_initialized' };
  }

  try {
    // Dynamically import TeaVM runtime
    const module = await import(`${TEAVM_BASE_URL}/compiler.wasm-runtime.js`);

    // Load the TeaVM compiler WASM
    teavmCompiler = await module.load(`${TEAVM_BASE_URL}/compiler.wasm`, {
      stackDeobfuscator: {
        enabled: true
      }
    });

    // Preload and cache classlibs for faster subsequent compilations
    const [sdkData, teavmClasslibData] = await Promise.all([
      fetch(`${TEAVM_BASE_URL}/compile-classlib-teavm.bin`).then((r) => r.arrayBuffer()),
      fetch(`${TEAVM_BASE_URL}/runtime-classlib-teavm.bin`).then((r) => r.arrayBuffer()),
    ]);

    cachedSdkData = new Int8Array(sdkData);
    cachedTeavmClasslibData = new Int8Array(teavmClasslibData);

    return { status: 'initialized' };
  } catch (error) {
    throw new Error(`Failed to initialize TeaVM: ${error.message}`);
  }
}

// Compile Java code
async function compileJava(code, mainClass, fileName) {
  if (!teavmCompiler) {
    throw new Error('TeaVM compiler not initialized');
  }

  const compilerLib = teavmCompiler.exports;
  const compiler = compilerLib.createCompiler();

  // Set SDK and classlibs
  compiler.setSdk(cachedSdkData);
  compiler.setTeaVMClasslib(cachedTeavmClasslibData);

  // Add source file
  compiler.addSourceFile(fileName, code);

  // Collect diagnostics
  const diagnostics = [];
  compiler.onDiagnostic((diagnostic) => {
    if (diagnostic.severity === 'ERROR') {
      diagnostics.push(diagnostic.message);
    }
  });

  // Compile
  const compileSuccess = compiler.compile();

  if (!compileSuccess || diagnostics.length > 0) {
    return {
      success: false,
      errors: diagnostics.join('\n') || 'Compilation failed'
    };
  }

  // Generate WebAssembly
  compiler.generateWebAssembly({
    outputName: 'app',
    mainClass: mainClass
  });

  // Get the generated WASM file
  const generatedWasm = compiler.getWebAssemblyOutputFile('app.wasm');

  return {
    success: true,
    wasmBytes: Array.from(generatedWasm) // Convert to regular array for transfer
  };
}

// Execute compiled WASM
async function executeJava(wasmBytes, mainClass) {
  try {
    // Import the runtime loader
    const module = await import(`${TEAVM_BASE_URL}/compiler.wasm-runtime.js`);

    // Convert array back to Uint8Array
    const wasmBytesArray = new Uint8Array(wasmBytes);

    // Load the generated WASM
    const outputTeavm = await module.load(wasmBytesArray, {
      stackDeobfuscator: { enabled: false }
    });

    // Capture console output
    const consoleOutput = [];
    const originalConsoleLog = console.log;

    console.log = (...args) => {
      consoleOutput.push(args.join(' '));
    };

    try {
      // Run the main method
      await outputTeavm.exports.main([]);
    } finally {
      console.log = originalConsoleLog;
    }

    return {
      success: true,
      output: consoleOutput.join('\n') || '(no output)'
    };
  } catch (error) {
    return {
      success: false,
      error: error.message || 'Execution failed'
    };
  }
}

// Compile and execute in one call (for convenience)
async function compileAndExecuteJava(code, mainClass, fileName) {
  // Compile
  const compileResult = await compileJava(code, mainClass, fileName);

  if (!compileResult.success) {
    return compileResult;
  }

  // Execute
  const executeResult = await executeJava(compileResult.wasmBytes, mainClass);

  return executeResult;
}

// Signal that worker is ready
self.postMessage({ action: 'ready' });
