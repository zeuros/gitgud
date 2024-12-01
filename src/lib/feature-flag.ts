import {isDev, isPlatformDarwin} from "./globals";

const Disable = false

/**
 * Enables the application to opt-in for preview features based on runtime
 * checks. This is backed by the GITHUB_DESKTOP_PREVIEW_FEATURES environment
 * variable, which is checked for non-development environments.
 */
function enableDevelopmentFeatures(): boolean {
  if (Disable) {
    return false
  }

  if (isDev()) {
    return true
  }

  if (process.env['GITHUB_DESKTOP_PREVIEW_FEATURES'] === '1') {
    return true
  }

  return false
}

/** Should the app enable beta features? */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore: this will be used again in the future
function enableBetaFeatures(): boolean {
  return enableDevelopmentFeatures()
}

/** Should git pass `--recurse-submodules` when performing operations? */
export function enableRecurseSubmodulesFlag(): boolean {
  return true
}

export function enableReadmeOverwriteWarning(): boolean {
  return enableBetaFeatures()
}

/** Should the app detect Windows Subsystem for Linux as a valid shell? */
export function enableWSLDetection(): boolean {
  return enableBetaFeatures()
}

/**
 * Should we allow reporting unhandled rejections as if they were crashes?
 */
export function enableUnhandledRejectionReporting(): boolean {
  return enableBetaFeatures()
}

/**
 * Should we allow x64 apps running under ARM translation to auto-update to
 * ARM64 builds?
 */
export function enableUpdateFromEmulatedX64ToARM64(): boolean {
  if (isPlatformDarwin()) {
    return true
  }

  return enableBetaFeatures()
}


/** Should we support image previews for dds files? */
export function enableImagePreviewsForDDSFiles(): boolean {
  return enableBetaFeatures()
}

export const enableCustomIntegration = () => true
