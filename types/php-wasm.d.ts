export interface PhpWebConstructor {
  new (): PhpWebInstance;
}

export interface PhpWebInstance {
  addEventListener(event: 'output' | 'error' | 'ready', handler: (event: CustomEvent) => void): void;
  removeEventListener(event: 'output' | 'error' | 'ready', handler: (event: CustomEvent) => void): void;
  run(code: string): Promise<void>;
  refresh(): void;
}

declare global {
  interface Window {
    PhpWebClass?: PhpWebConstructor;
  }

  interface WindowEventMap {
    'phpwasm-ready': Event;
    'phpwasm-error': CustomEvent<string>;
  }
}
