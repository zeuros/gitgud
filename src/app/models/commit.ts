import {GitAuthor} from "./git-author";
import {CommitIdentity} from "./commit-identity";
import {isCoAuthoredByTrailer, ITrailer} from "./interpret-trailers";
import {LogObject} from "./log-object";

/**
 * Extract any Co-Authored-By trailers from an array of arbitrary
 * trailers.
 */
const extractCoAuthors = (trailers: ReadonlyArray<ITrailer>) => {
  const coAuthors = []

  for (const trailer of trailers) {
    if (isCoAuthoredByTrailer(trailer)) {
      const author = GitAuthor.parse(trailer.value)
      if (author) {
        coAuthors.push(author)
      }
    }
  }

  return coAuthors
}

const trimCoAuthorsTrailers = (trailers: ReadonlyArray<ITrailer>, body: string) => {
  let trimmedCoAuthors = body

  trailers.filter(isCoAuthoredByTrailer).forEach(({token, value}) => {
    trimmedCoAuthors = trimmedCoAuthors.replace(`${token}: ${value}`, '')
  })

  return trimmedCoAuthors
}

export const parseRawUnfoldedTrailers = (trailers: string, separators: string) => {
  const lines = trailers.split('\n')
  const parsedTrailers = new Array<ITrailer>()

  for (const line of lines) {
    const trailer = parseSingleUnfoldedTrailer(line, separators)

    if (trailer) {
      parsedTrailers.push(trailer)
    }
  }

  return parsedTrailers
}

const parseSingleUnfoldedTrailer = (
  line: string,
  separators: string
): ITrailer | null => {
  for (const separator of separators) {
    const ix = line.indexOf(separator)
    if (ix > 0) {
      return {
        token: line.substring(0, ix).trim(),
        value: line.substring(ix + 1).trim(),
      }
    }
  }

  return null
}

/**
 * @param sha
 * @param shortSha
 * @param summary The first line of the commit message.
 * @param body The commit message without the first line and CR.
 * @param branches Branches the commit is pointed by, separated by comma. e.g: origin/HEAD, origin/develop
 * @param ref Almost always present, tells which branch commit comes from.
 * @param refLogSubject TODO: remove ?
 * @param author Information about the author of this commit.
 *               Includes name, email and date.
 * @param committer Information about the committer of this commit.
 *                  Includes name, email and date.
 * @param parentSHAs The SHAs for the parents of the commit.
 * @param trailers Parsed, unfolded trailers from the commit message body,
 *                 if any, as interpreted by `git interpret-trailers`
 * @param tags Tags associated with this commit.
 */
export class Commit implements LogObject {
  /**
   * A list of co-authors parsed from the commit message
   * trailers.
   */
  readonly coAuthors: ReadonlyArray<GitAuthor>

  /**
   * The commit body after removing coauthors
   */
  readonly bodyNoCoAuthors: string

  /**
   * A value indicating whether the author and the committer
   * are the same person.
   */
  readonly authoredByCommitter: boolean

  /**
   * Whether the commit is a merge commit (i.e. has at least 2 parents)
   */
  readonly isMergeCommit: boolean

  constructor(
    public readonly sha: string,
    public readonly shortSha: string,
    public readonly summary: string,
    public readonly body: string,
    public readonly branches: string, // Branches the commit is pointed by, separated by comma. e.g: origin/HEAD, origin/develop
    public readonly ref: string, //
    public readonly refLogSubject: string,
    public readonly author: CommitIdentity,
    public readonly committer: CommitIdentity,
    public readonly parentSHAs: ReadonlyArray<string>,
    public readonly trailers: ReadonlyArray<ITrailer>,
    public readonly tags: ReadonlyArray<string>
  ) {
    this.coAuthors = extractCoAuthors(trailers)

    this.authoredByCommitter =
      this.author.name === this.committer.name &&
      this.author.email === this.committer.email

    this.bodyNoCoAuthors = trimCoAuthorsTrailers(trailers, body)

    this.isMergeCommit = parentSHAs.length > 1
  }
}