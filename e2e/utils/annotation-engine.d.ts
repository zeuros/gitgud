// Globals that annotation-engine.js installs in the app window (injected by the demo recording)
declare global {
  interface Window {
    __annDraw?: (text: string, tipX: number, tipY: number, side: string) => void;
    __annClear?: () => void;
  }
}

export {};
