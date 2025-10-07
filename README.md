# WASM Compilers

An open-source, browser-based code compiler and playground that supports multiple programming languages using WebAssembly. All code execution happens entirely in your browser - no backend servers or external APIs required!

## Features

- **Multi-Language Support**: JavaScript, PHP, Python, Java, and C
- **Browser-Based Execution**: No server setup required - everything runs in your browser
- **Monaco Editor**: Full-featured code editor with syntax highlighting and IntelliSense
- **Real-Time Console**: See your code output immediately
- **Tab Management**: Work on multiple files simultaneously
- **Persistent Storage**: Your code and tabs are automatically saved and restored
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
- Powered by [CheerpJ](https://leaningtech.com/cheerpj/)
- Java bytecode execution in WebAssembly
- Runs entirely in the browser

### C
- Powered by [WCC (WebAssembly C Compiler)](https://github.com/tyfkda/xcc)
- Compiles C to WebAssembly
- Runs entirely in the browser
- Full C standard library support

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
- `useJavaExecutor`: Java execution using CheerpJ (WebAssembly)
- `useCExecutor`: C compilation and execution using WCC (WebAssembly)

## Contributing

We love contributions! Here's how you can help make WASM Compilers even better:

### How to Contribute

1. **Fork the Repository**
   - Click the "Fork" button at the top right of this repository
   - Clone your fork locally:
     ```bash
     git clone https://github.com/YOUR_USERNAME/wasm-compilers.git
     cd wasm-compilers
     ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

   Use descriptive branch names:
   - `feature/add-rust-support` for new features
   - `fix/python-matplotlib-bug` for bug fixes
   - `docs/update-readme` for documentation
   - `refactor/improve-executor-hooks` for refactoring

3. **Make Your Changes**
   - Write clean, maintainable code
   - Follow the existing code style
   - Test your changes thoroughly
   - Add comments where necessary

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

   Use conventional commit messages:
   - `feat:` for new features
   - `fix:` for bug fixes
   - `docs:` for documentation changes
   - `refactor:` for code refactoring
   - `style:` for formatting changes
   - `test:` for adding tests

5. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your fork and branch
   - Provide a clear description of your changes
   - Link any related issues

### What You Can Contribute

- 🐛 **Report bugs** - Found something broken? Let us know!
- 💡 **Suggest features** - Have ideas for improvements? Share them!
- 🔧 **Fix issues** - Check out our open issues and submit a fix
- 📝 **Improve documentation** - Help others understand the project better
- 🌐 **Add language support** - Want to add a new programming language?
- 🎨 **Enhance UI/UX** - Make the interface more beautiful and intuitive
- ⚡ **Performance improvements** - Help make it faster!

### Need Help?

- Check existing issues and pull requests first
- Feel free to ask questions in issues
- Join discussions and share your ideas

All contributions, big or small, are greatly appreciated! 🙏

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Credits

- Built with inspiration from online code playgrounds
- PHP support: [php-wasm](https://github.com/seanmorris/php-wasm)
- Python support: [Pyodide](https://pyodide.org/)
- Java support: [CheerpJ](https://leaningtech.com/cheerpj/)
- C support: [WCC (WebAssembly C Compiler)](https://github.com/tyfkda/xcc)
- Editor: [Monaco Editor](https://microsoft.github.io/monaco-editor/)

---

Made by [Ilyass Anida](https://github.com/ilyassan) for the open-source community

Special thanks to all the amazing open-source compiler projects that made this possible: php-wasm, Pyodide, CheerpJ, and WCC. This project wouldn't exist without their incredible work!
