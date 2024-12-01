import * as os from "node:os";

declare const isPlatformDarwin = () => os.platform() === "darwin"

declare const isPlatformWin32 = () => os.platform() === "win32"

declare const isPlatformLinux = () => os.platform() === "win32"

declare const isDev = () => false

declare namespace NodeJS {
  interface Process extends EventEmitter {
    on(
      event: 'send-non-fatal-exception',
      listener: (error: Error, context?: { [key: string]: string }) => void
    ): this
    emit(
      event: 'send-non-fatal-exception',
      error: Error,
      context?: { [key: string]: string }
    ): this
    removeListener(event: 'exit', listener: Function): this
  }
}

declare namespace Electron {
  type AppleActionOnDoubleClickPref = 'Maximize' | 'Minimize' | 'None'
}


