// JavaScript execution worker
self.onmessage = async function(e) {
  const { code } = e.data;
  const outputs = [];

  try {
    // Create a sandboxed console
    const logs = [];
    const errors = [];

    const sandboxedConsole = {
      log: (...args) => {
        logs.push(args.map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "));
      },
      error: (...args) => {
        errors.push(args.map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "));
      },
      warn: (...args) => {
        logs.push("⚠️ " + args.map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "));
      },
      info: (...args) => {
        logs.push("ℹ️ " + args.map(arg =>
          typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(" "));
      },
    };

    // Execute code in sandboxed environment
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const execute = new AsyncFunction("console", code);

    // Run the code
    const result = await execute(sandboxedConsole);

    // Add implicit return value if any
    if (result !== undefined) {
      logs.push(typeof result === "object" ? JSON.stringify(result, null, 2) : String(result));
    }

    // Collect outputs
    logs.forEach(log => {
      outputs.push({ type: "output", content: log });
    });

    errors.forEach(error => {
      outputs.push({ type: "error", content: error });
    });

    if (outputs.length === 0) {
      outputs.push({ type: "output", content: "(no output)" });
    }

    self.postMessage({ success: true, outputs });

  } catch (error) {
    const errorName = error instanceof Error ? error.name : "Error";
    const errorMessage = error instanceof Error ? error.message : String(error);
    outputs.push({
      type: "error",
      content: `${errorName}: ${errorMessage}`,
    });

    self.postMessage({ success: false, outputs });
  }
};
