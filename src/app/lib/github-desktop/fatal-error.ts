/** Throw an error. */
export const fatalError = (msg: string): never => {
  throw new Error(msg)
}

/**
 * Unwrap a value that, according to the type system, could be null or
 * undefined, but which we know is not. If the value _is_ null or undefined,
 * this will throw. The message should contain the rationale for knowing the
 * value is defined.
 */
export const forceUnwrap = <T>(message: string, x: T | null | undefined): T => {
  if (x == null) {
    return fatalError(message)
  } else {
    return x
  }
}