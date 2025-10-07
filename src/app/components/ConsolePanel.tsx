interface ConsoleOutput {
  type: "output" | "error" | "info" | "image";
  content: string;
  timestamp: number;
}

interface ConsolePanelProps {
  outputs: ConsoleOutput[];
}

export default function ConsolePanel({ outputs }: ConsolePanelProps) {
  return (
    <div className="h-full w-full flex flex-col bg-[#1e1e1e]">
      <div className="px-4 py-2 bg-[#252526] border-b border-secondary-light">
        <h2 className="text-sm font-semibold text-gray">Console</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 font-mono text-sm scrollbar-thin scrollbar-thumb-secondary scrollbar-track-transparent">
        {outputs.length === 0 ? (
          <p className="text-gray italic">Output will appear here...</p>
        ) : (
          outputs.map((output, index) => {
            // Handle image output (matplotlib plots)
            if (output.type === "image") {
              return (
                <div key={`${output.timestamp}-${index}`} className="mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:image/png;base64,${output.content}`}
                    alt="Matplotlib plot"
                    className="max-w-full h-auto border border-secondary-light rounded"
                  />
                </div>
              );
            }

            // Handle text output
            const lines = output.content.split('\n');
            return (
              <div key={`${output.timestamp}-${index}`}>
                {lines.map((line, lineIndex) => (
                  <div
                    key={`${output.timestamp}-${index}-${lineIndex}`}
                    className={`mb-1 ${
                      output.type === "error"
                        ? "text-red-400"
                        : output.type === "info"
                        ? "text-blue-400"
                        : "text-green-400"
                    }`}
                  >
                    <span className="text-gray mr-2">›</span>
                    {line}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
