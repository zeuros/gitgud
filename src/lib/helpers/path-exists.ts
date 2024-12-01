import { access } from 'fs/promises'
import constant from 'lodash/constant'

/**
 * Returns a value indicating whether or not the provided path exists (as in
 * whether it's visible to the current process or not).
 */
export const pathExists = (path: string): Promise<boolean> =>
  access(path).then(constant(true), constant(false))
