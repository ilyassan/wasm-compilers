# WASM Compilers

An open-source, browser-based code compiler and playground that supports multiple programming languages using WebAssembly and cloud execution APIs.

## Features

- **Multi-Language Support**: JavaScript, PHP, Python, Java, and C
- **Browser-Based Execution**: No server setup required - everything runs in your browser
- **Monaco Editor**: Full-featured code editor with syntax highlighting and IntelliSense
- **Real-Time Console**: See your code output immediately
- **Tab Management**: Work on multiple files simultaneously
- **Resizable Layout**: Adjust editor and console panel sizes to your preference
- **Mobile Responsive**: Works on desktop and mobile devices

## Supported Languages

### JavaScript
- Runs directly in the browser using Web Workers
- Sandboxed execution environment
- Supports async/await and modern ES features

### PHP
- Powered by [php-wasm](https://github.com/seanmorris/php-wasm)
- Full PHP 8.x support
- Runs entirely in the browser

### Python
- Powered by [Pyodide](https://pyodide.org/)
- Supports popular packages: NumPy, Pandas, Matplotlib, SciPy, and more
- Automatic package installation
- Matplotlib plot rendering

### Java
- Uses the Piston API for compilation and execution
- Java 15 support
- Full standard library access

### C
- Uses the Piston API for compilation and execution
- GCC 10.2.0 support
- Standard C library included

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Technology Stack

- **Framework**: Next.js 15
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Editor**: Monaco Editor
- **UI Components**: Radix UI
- **Icons**: React Icons

## Usage

1. Select a programming language from the dropdown
2. Write your code in the Monaco editor
3. Click "Run" to execute
4. View output in the console panel
5. Use tabs to work on multiple files

## Architecture

The project follows a modular architecture with separate executor hooks for each language:

- `useJsExecutor`: JavaScript execution using Web Workers
- `usePhpExecutor`: PHP execution using php-wasm
- `usePythonExecutor`: Python execution using Pyodide
- `useJavaExecutor`: Java execution using Piston API
- `useCExecutor`: C execution using Piston API

## Contributing

Contributions are welcome! Feel free to:

- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Credits

- Built with inspiration from online code playgrounds
- PHP support: [php-wasm](https://github.com/seanmorris/php-wasm)
- Python support: [Pyodide](https://pyodide.org/)
- Java/C support: [Piston API](https://github.com/engineer-man/piston)
- Editor: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

Made with ❤️ by the open-source community
