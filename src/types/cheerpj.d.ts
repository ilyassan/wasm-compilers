// CheerpJ global functions
declare function cheerpjInit(options?: { status?: string }): Promise<void>;
declare function cheerpjRunMain(...args: string[]): Promise<number>;
declare function cheerpOSAddStringFile(path: string, content: string): void;
