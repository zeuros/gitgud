/**
 * A representation of a Git commit message trailer.
 *
 * See git-interpret-trailers for more information.
 */
export interface Trailer {
  readonly token: string
  readonly value: string
}