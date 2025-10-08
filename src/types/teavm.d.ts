interface TeaVMDiagnostic {
  type: string;
  severity: "ERROR" | "WARNING" | "INFO";
  message: string;
  location?: string;
}

interface TeaVMCompiler {
  setSdk: (data: Int8Array) => void;
  setTeaVMClasslib: (data: Int8Array) => void;
  addSourceFile: (filename: string, content: string) => void;
  onDiagnostic: (callback: (diagnostic: TeaVMDiagnostic) => void) => void;
  compile: () => boolean;
  generateWebAssembly: (options: { outputName: string; mainClass: string }) => void;
  getWasm: (outputName: string) => Uint8Array;
  getWebAssemblyOutputFile: (filename: string) => Uint8Array;
}

interface TeaVMCompilerLib {
  createCompiler: () => TeaVMCompiler;
  installWorker: () => void;
  main: (args: string[]) => Promise<void>;
}

interface TeaVMInstance {
  exports: TeaVMCompilerLib;
}

declare global {
  interface Window {
    teavmCompiler?: TeaVMInstance;
  }
}

export {};
