/**
 * A representation of a Git commit message trailer.
 *
 * See git-interpret-trailers for more information.
 */
export interface ITrailer {
  readonly token: string
  readonly value: string
}

/**
 * Gets a value indicating whether the trailer token is
 * Co-Authored-By. Does not validate the token value.
 */
export const isCoAuthoredByTrailer = ({token}: ITrailer) => token.toLowerCase() === 'co-authored-by';

