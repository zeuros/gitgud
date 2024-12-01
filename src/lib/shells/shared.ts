import { ChildProcess } from 'child_process'

import * as Darwin from './darwin'
import * as Win32 from './win32'
import * as Linux from './linux'
import { ShellError } from './error'
import { pathExists } from '../helpers/path-exists'
import { ICustomIntegration } from '../custom-integration'

export type Shell = Darwin.Shell | Win32.Shell | Linux.Shell

export type FoundShell<T extends Shell> = {
  readonly shell: T
  readonly path: string
  readonly extraArgs?: ReadonlyArray<string>
} & (T extends Darwin.Shell
  ? {
      readonly bundleID: string
    }
  : {})

type AnyFoundShell = FoundShell<Shell>

/** The default shell. */
export const Default = (function () {
  if (isPlatformDarwin()) {
    return Darwin.Default
  } else if (isPlatformWin32()) {
    return Win32.Default
  } else {
    return Linux.Default
  }
})()

let shellCache: ReadonlyArray<AnyFoundShell> | null = null

/** Parse the label into the specified shell type. */
export function parse(label: string): Shell {
  if (isPlatformDarwin()) {
    return Darwin.parse(label)
  } else if (isPlatformWin32()) {
    return Win32.parse(label)
  } else if (isPlatformLinux()) {
    return Linux.parse(label)
  }

  throw new Error(
    `Platform not currently supported for resolving shells: ${process.platform}`
  )
}

/** Get the shells available for the user. */
export async function getAvailableShells(): Promise<
  ReadonlyArray<AnyFoundShell>
> {
  if (shellCache) {
    return shellCache
  }

  if (isPlatformDarwin()) {
    shellCache = await Darwin.getAvailableShells()
    return shellCache
  } else if (isPlatformWin32()) {
    shellCache = await Win32.getAvailableShells()
    return shellCache
  } else if (isPlatformLinux()) {
    shellCache = await Linux.getAvailableShells()
    return shellCache
  }

  return Promise.reject(
    `Platform not currently supported for resolving shells: ${process.platform}`
  )
}

/** Find the given shell or the default if the given shell can't be found. */
export async function findShellOrDefault(shell: Shell): Promise<AnyFoundShell> {
  const available = await getAvailableShells()
  const found = available.find(s => s.shell === shell)
  if (found) {
    return found
  } else {
    return available.find(s => s.shell === Default)!
  }
}

/** Launch the given shell at the path. */
export async function launchShell(
  shell: AnyFoundShell,
  path: string,
  onError: (error: Error) => void
): Promise<void> {
  // We have to manually cast the wider `Shell` type into the platform-specific
  // type. This is less than ideal, but maybe the best we can do without
  // platform-specific build targets.
  const exists = await pathExists(shell.path)
  if (!exists) {
    const label = isPlatformDarwin() ? 'Settings' : 'Options'
    throw new ShellError(
      `Could not find executable for '${shell.shell}' at path '${shell.path}'.  Please open ${label} and select an available shell.`
    )
  }

  let cp: ChildProcess | null = null

  if (isPlatformDarwin()) {
    cp = Darwin.launch(shell as FoundShell<Darwin.Shell>, path)
  } else if (isPlatformWin32()) {
    cp = Win32.launch(shell as FoundShell<Win32.Shell>, path)
  } else if (isPlatformLinux()) {
    cp = Linux.launch(shell as FoundShell<Linux.Shell>, path)
  }

  if (cp != null) {
    addErrorTracing(shell.shell, cp, onError)
    return Promise.resolve()
  } else {
    return Promise.reject(
      `Platform not currently supported for launching shells: ${process.platform}`
    )
  }
}

/** Launch custom shell at the path. */
export async function launchCustomShell(
  customShell: ICustomIntegration,
  path: string,
  onError: (error: Error) => void
): Promise<void> {
  // We have to manually cast the wider `Shell` type into the platform-specific
  // type. This is less than ideal, but maybe the best we can do without
  // platform-specific build targets.
  const exists = await pathExists(customShell.path)
  if (!exists) {
    const label = isPlatformDarwin() ? 'Settings' : 'Options'
    throw new ShellError(
      `Could not find executable for custom shell at path '${customShell.path}'.  Please open ${label} and select an available shell.`
    )
  }

  let cp: ChildProcess | null = null

  if (isPlatformDarwin()) {
    cp = Darwin.launchCustomShell(customShell, path)
  } else if (isPlatformWin32()) {
    cp = Win32.launchCustomShell(customShell, path)
  } else if (isPlatformLinux()) {
    cp = Linux.launchCustomShell(customShell, path)
  }

  if (cp != null) {
    addErrorTracing('Custom Shell', cp, onError)
    return Promise.resolve()
  } else {
    return Promise.reject(
      `Platform not currently supported for launching shells: ${process.platform}`
    )
  }
}

function addErrorTracing(
  shell: Shell | 'Custom Shell',
  cp: ChildProcess,
  onError: (error: Error) => void
) {
  if (cp.stderr !== null) {
    cp.stderr.on('data', chunk => {
      const text = chunk instanceof Buffer ? chunk.toString() : chunk
      console.debug(`[${shell}] stderr: '${text}'`)
    })
  }

  cp.on('error', err => {
    console.debug(`[${shell}] an error was encountered`, err)
    onError(err)
  })

  cp.on('exit', code => {
    if (code !== 0) {
      console.debug(`[${shell}] exit code: ${code}`)
    }
  })
}
