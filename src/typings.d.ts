export {};
declare global {
  interface Window {
    electron: {
      fs: {
        readdirSync: typeof import('fs').readdirSync;
        isFile: (file: string) => boolean;
      };
      path: {
        resolve: typeof import('path').resolve;
        dirname: typeof import('path').dirname;
        extname: typeof import('path').extname;
      };
      chokidar: {
        watch: (id: string, paths: string | string[], options?: import('chokidar').ChokidarOptions) => void;
        on: (id: string, event: string, cb: (...args: unknown[]) => void) => void;
        close: (id: string) => void;
      };
      crypto: {
        md5: (data: string) => string;
      };
      dialog: {
        showOpenDialogSync: typeof import('@electron/remote').dialog.showOpenDialogSync;
      };
      execFile: (cmd: string, args: string[], options: import('child_process').ExecOptions) => Promise<{ stdout: string; stderr: string }>;
      onWindowFocus: (cb: () => void) => import('electron').BrowserWindow;
      processEnv: NodeJS.ProcessEnv;
    };
  }
}