declare module 'vite' {
  export interface ViteDevServer {
    middlewares: any;
    transformIndexHtml(url: string, html: string): Promise<string>;
    ssrFixStacktrace(error: Error): void;
  }

  export function createServer(options: any): Promise<ViteDevServer>;
  export function createLogger(): {
    info: (msg: string, options?: any) => void;
    warn: (msg: string, options?: any) => void;
    error: (msg: string, options?: any) => void;
  };
} 