import {DiffHunk, DiffHunkExpansionType, DiffHunkHeader, IRawDiff} from "./model/diff/raw-diff"
import {GitRepository} from "../../models/git-repository";
import {AppFileStatusKind, CommittedFileChange, FileChange, WorkingDirectoryFileChange} from "./model/status";
import {DiffType, IImageDiff, ILargeTextDiff, LineEndingsChange} from "./model/diff/diff-data";
import {GitRepositoryService} from "../../services/git-repository.service";
import {forkJoin, map, Observable} from "rxjs";
import {DiffParser} from "./diff-parser";
import {forceUnwrap} from "./throw-ex";
import * as Path from "node:path";
import {getBlobContents} from "./show";
import {Image} from "./model/diff/image";
import {IStatusEntry} from "./status-parser";
import {createLogParser} from "./git-delimiter-parser";

/**
 * V8 has a limit on the size of string it can create (~256MB), and unless we want to
 * trigger an unhandled exception we need to do the encoding conversion by hand.
 *
 * This is a hard limit on how big a buffer can be and still be converted into
 * a string.
 */
const MaxDiffBufferSize = 70e6 // 70MB in decimal

/**
 * Where `MaxDiffBufferSize` is a hard limit, this is a suggested limit. Diffs
 * bigger than this _could_ be displayed but it might cause some slowness.
 */
const MaxReasonableDiffSize = MaxDiffBufferSize / 16 // ~4.375MB in decimal

/**
 * The longest line length we should try to display. If a diff has a line longer
 * than this, we probably shouldn't attempt it
 */
const MaxCharactersPerLine = 5000

/**
 * Utility function to check whether parsing this buffer is going to cause
 * issues at runtime.
 *
 * @param buffer A buffer of binary text from a spawned process
 */
function isValidBuffer(buffer: Buffer) {
  return buffer.length <= MaxDiffBufferSize
}

/** Is the buffer too large for us to reasonably represent? */
function isBufferTooLarge(buffer: Buffer) {
  return buffer.length >= MaxReasonableDiffSize
}

/** Is the diff too large for us to reasonably represent? */
function isDiffTooLarge(diff: IRawDiff) {
  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.text.length > MaxCharactersPerLine) {
        return true
      }
    }
  }

  return false
}

/**
 *  Defining the list of known extensions we can render inside the app
 */
const imageFileExtensions = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.bmp',
  '.avif',
])


/**
 * Render the difference between a file in the given commit and its parent
 *
 * @param commitish A commit SHA or some other identifier that ultimately dereferences to a commit.
 */
export async function getCommitDiff(
  gitRepositoryService: GitRepositoryService,
  file: FileChange,
  commitish: string,
  hideWhitespaceInDiff: boolean = false
) {
  const args = [
    'log',
    commitish,
    ...(hideWhitespaceInDiff ? ['-w'] : []),
    '-m',
    '-1',
    '--first-parent',
    '--patch-with-raw',
    '--format=',
    '-z',
    '--no-color',
    '--',
    file.path,
  ]

  if (
    file.status.kind === AppFileStatusKind.Renamed ||
    file.status.kind === AppFileStatusKind.Copied
  ) {
    args.push(file.status.oldPath)
  }


  return gitRepositoryService.git(args).pipe(map(r => buildDiff(new Buffer(r), gitRepositoryService, file, commitish)))
}

/**
 * Render the diff between two branches with --merge-base for a file
 * (Show what would be the result of merge)
 */
export async function getBranchMergeBaseDiff(
  gitRepositoryService: GitRepositoryService,
  gitRepository: GitRepository,
  file: FileChange,
  baseBranchName: string,
  comparisonBranchName: string,
  hideWhitespaceInDiff: boolean = false,
  latestCommit: string
) {
  const args = [
    'diff',
    '--merge-base',
    baseBranchName,
    comparisonBranchName,
    ...(hideWhitespaceInDiff ? ['-w'] : []),
    '--patch-with-raw',
    '-z',
    '--no-color',
    '--',
    file.path,
  ]

  if (
    file.status.kind === AppFileStatusKind.Renamed ||
    file.status.kind === AppFileStatusKind.Copied
  ) {
    args.push(file.status.oldPath)
  }

  return gitRepositoryService.git(args).pipe(map(result => buildDiff(new Buffer(result), gitRepositoryService, file, latestCommit)));
}

/**
 * Render the difference between two commits for a file
 *
 */
// export async function getCommitRangeDiff(
//   gitRepositoryService: GitRepositoryService,
//   git: (args?: string[]) => Observable<string>,
//   file: FileChange,
//   commits: ReadonlyArray<string>,
//   hideWhitespaceInDiff: boolean = false,
//   useNullTreeSHA: boolean = false
// ): Promise<IDiff> {
//   if (commits.length === 0) {
//     throw new Error('No commits to diff...')
//   }
//
//   const oldestCommitRef = useNullTreeSHA ? NullTreeSHA : `${commits[0]}^`
//   const latestCommit = commits.at(-1) ?? '' // can't be undefined since commits.length > 0
//   const args = [
//     'diff',
//     oldestCommitRef,
//     latestCommit,
//     ...(hideWhitespaceInDiff ? ['-w'] : []),
//     '--patch-with-raw',
//     '--format=',
//     '-z',
//     '--no-color',
//     '--',
//     file.path,
//   ]
//
//   if (
//     file.status.kind === AppFileStatusKind.Renamed ||
//     file.status.kind === AppFileStatusKind.Copied
//   ) {
//     args.push(file.status.oldPath)
//   }
//
//   return gitRepositoryService.git(args).pipe(map(rangeDiffRaw => buildDiff(new Buffer(rangeDiffRaw), repository, file, latestCommit)))
// }

/**
 * Get the files that were changed for the merge base comparison of two branches.
 * (What would be the result of a merge)
 */
// export async function getBranchMergeBaseChangedFiles(
//   git: (args?: string[]) => Observable<string>,
//   baseBranchName: string,
//   comparisonBranchName: string,
//   latestComparisonBranchCommitRef: string
// ): Promise<IChangesetData | null> {
//   const baseArgs = [
//     'diff',
//     '--merge-base',
//     baseBranchName,
//     comparisonBranchName,
//     '-C',
//     '-M',
//     '-z',
//     '--raw',
//     '--numstat',
//     '--',
//   ]
//
//   const mergeBaseCommit = await getMergeBase(
//     repository,
//     baseBranchName,
//     comparisonBranchName
//   )
//
//   if (mergeBaseCommit === null) {
//     return null
//   }
//
//   const result = git(
//     baseArgs,
//
//     'getBranchMergeBaseChangedFiles'
//   )
//
//   return parseRawLogWithNumstat(
//     result.stdout,
//     `${latestComparisonBranchCommitRef}`,
//     mergeBaseCommit
//   )
// }

// export async function getCommitRangeChangedFiles(
//   git: (args?: string[]) => Observable<string>,
//   shas: ReadonlyArray<string>,
//   useNullTreeSHA: boolean = false
// ): Promise<IChangesetData> {
//   if (shas.length === 0) {
//     throw new Error('No commits to diff...')
//   }
//
//   const oldestCommitRef = useNullTreeSHA ? NullTreeSHA : `${shas[0]}^`
//   const latestCommitRef = shas.at(-1) ?? '' // can't be undefined since shas.length > 0
//   const baseArgs = [
//     'diff',
//     oldestCommitRef,
//     latestCommitRef,
//     '-C',
//     '-M',
//     '-z',
//     '--raw',
//     '--numstat',
//     '--',
//   ]
//
//   const {stdout, gitError} = git(
//     baseArgs,
//
//     'getCommitRangeChangedFiles',
//     {
//       expectedErrors: new Set([GitError.BadRevision]),
//     }
//   )
//
//   // This should only happen if the oldest commit does not have a parent (ex:
//   // initial commit of a branch) and therefore `SHA^` is not a valid reference.
//   // In which case, we will retry with the null tree sha.
//   if (gitError === GitError.BadRevision && useNullTreeSHA === false) {
//     const useNullTreeSHA = true
//     return getCommitRangeChangedFiles(repository, shas, useNullTreeSHA)
//   }
//
//   return parseRawLogWithNumstat(stdout, latestCommitRef, oldestCommitRef)
// }
//
// /**
//  * Render the diff for a file within the repository working directory. The file will be
//  * compared against HEAD if it's tracked, if not it'll be compared to an empty file meaning
//  * that all content in the file will be treated as additions.
//  */
// export async function getWorkingDirectoryDiff(
//   git: (args?: string[]) => Observable<string>,
//   file: WorkingDirectoryFileChange,
//   hideWhitespaceInDiff: boolean = false
// ): Promise<IDiff> {
//   // `--no-ext-diff` should be provided wherever we invoke `git diff` so that any
//   // diff.external program configured by the user is ignored
//   const args = [
//     'diff',
//     ...(hideWhitespaceInDiff ? ['-w'] : []),
//     '--no-ext-diff',
//     '--patch-with-raw',
//     '-z',
//     '--no-color',
//   ]
//   const successExitCodes = new Set([0])
//   const isSubmodule = file.status.submoduleStatus !== undefined
//
//   // For added submodules, we'll use the "default" parameters, which are able
//   // to output the submodule commit.
//   if (
//     !isSubmodule &&
//     (file.status.kind === AppFileStatusKind.New ||
//       file.status.kind === AppFileStatusKind.Untracked)
//   ) {
//     // `git diff --no-index` seems to emulate the exit codes from `diff` irrespective of
//     // whether you set --exit-code
//     //
//     // this is the behavior:
//     // - 0 if no changes found
//     // - 1 if changes found
//     // -   and error otherwise
//     //
//     // citation in source:
//     // https://github.com/git/git/blob/1f66975deb8402131fbf7c14330d0c7cdebaeaa2/diff-no-index.c#L300
//     successExitCodes.add(1)
//     args.push('--no-index', '--', '/dev/null', file.path)
//   } else if (file.status.kind === AppFileStatusKind.Renamed) {
//     // NB: Technically this is incorrect, the best kind of incorrect.
//     // In order to show exactly what will end up in the commit we should
//     // perform a diff between the new file and the old file as it appears
//     // in HEAD. By diffing against the index we won't show any changes
//     // already staged to the renamed file which differs from our other diffs.
//     // The closest I got to that was running hash-object and then using
//     // git diff <blob> <blob> but that seems a bit excessive.
//     args.push('--', file.path)
//   } else {
//     args.push('HEAD', '--', file.path)
//   }
//
//   const {stdout, stderr} = git(
//     args,
//
//     'getWorkingDirectoryDiff',
//     {successExitCodes, encoding: 'buffer'}
//   )
//   const lineEndingsChange = parseLineEndingsWarning(stderr)
//
//   return buildDiff(stdout, repository, file, 'HEAD', lineEndingsChange)
// }
//
async function getImageDiff(
  file: FileChange,
  oldestCommitish: string
): Promise<IImageDiff> {
  let current: Image | undefined = undefined
  let previous: Image | undefined = undefined

  // Are we looking at a file in the working directory or a file in a commit?
  if (file instanceof WorkingDirectoryFileChange) {
    // No idea what to do about this, a conflicted binary (presumably) file.
    // Ideally we'd show all three versions and let the user pick but that's
    // a bit out of scope for now.
    if (file.status.kind === AppFileStatusKind.Conflicted) {
      return {kind: DiffType.Image}
    }

    // Does it even exist in the working directory?
    // if (file.status.kind !== AppFileStatusKind.Deleted) {
    //   current = await getWorkingDirectoryImage(repository, file)
    // }

    if (
      file.status.kind !== AppFileStatusKind.New &&
      file.status.kind !== AppFileStatusKind.Untracked
    ) {
      // If we have file.oldPath that means it's a rename so we'll
      // look for that file.
      // previous = await getBlobImage(
      //   gitRepositoryService,
      //   repository,
      //   getOldPathOrDefault(file),
      //   'HEAD'
      // )
    }
  } else {
    // File status can't be conflicted for a file in a commit
    if (file.status.kind !== AppFileStatusKind.Deleted) {
      // current = await getBlobImage(repository, file.path, oldestCommitish)
    }

    // File status can't be conflicted for a file in a commit
    if (
      file.status.kind !== AppFileStatusKind.New &&
      file.status.kind !== AppFileStatusKind.Untracked &&
      file.status.kind !== AppFileStatusKind.Deleted
    ) {
      // TODO: commitish^ won't work for the first commit
      //
      // If we have file.oldPath that means it's a rename so we'll
      // look for that file.
      // previous = await getBlobImage(
      //   repository,
      //   getOldPathOrDefault(file),
      //   `${oldestCommitish}^`
      // )
    }

    if (
      file instanceof CommittedFileChange &&
      file.status.kind === AppFileStatusKind.Deleted
    ) {
      // previous = await getBlobImage(
      //   repository,
      //   getOldPathOrDefault(file),
      //   file.parentCommitish
      // )
    }
  }

  return {
    kind: DiffType.Image,
    previous: previous,
    current: current,
  }
}

export async function convertDiff(
  file: FileChange,
  diff: IRawDiff,
  oldestCommitish: string,
  lineEndingsChange?: LineEndingsChange
) {
  const extension = Path.extname(file.path).toLowerCase()

  if (diff.isBinary) {
    // some extension we don't know how to parse, never mind
    if (!imageFileExtensions.has(extension)) {
      return {
        kind: DiffType.Binary,
      }
    } else {
      return getImageDiff(file, oldestCommitish)
    }
  }

  return {
    kind: DiffType.Text,
    text: diff.contents,
    hunks: diff.hunks,
    lineEndingsChange,
    maxLineNumber: diff.maxLineNumber,
    hasHiddenBidiChars: diff.hasHiddenBidiChars,
  }
}


/**
 * Map a given file extension to the related data URL media type
 */
function getMediaType(extension: string) {
  if (extension === '.png') {
    return 'image/png'
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpg'
  }
  if (extension === '.gif') {
    return 'image/gif'
  }
  if (extension === '.ico') {
    return 'image/x-icon'
  }
  if (extension === '.webp') {
    return 'image/webp'
  }
  if (extension === '.bmp') {
    return 'image/bmp'
  }
  if (extension === '.avif') {
    return 'image/avif'
  }
  if (extension === '.dds') {
    return 'image/vnd-ms.dds'
  }

  // fallback value as per the spec
  return 'text/plain'
}

// /**
//  * `git diff` will write out messages about the line ending changes it knows
//  * about to `stderr` - this rule here will catch this and also the to/from
//  * changes based on what the user has configured.
//  */
// const lineEndingsChangeRegex =
//   /', (CRLF|CR|LF) will be replaced by (CRLF|CR|LF) the .*/
//
// /**
//  * Utility function for inspecting the stderr output for the line endings
//  * warning that Git may report.
//  *
//  * @param error A buffer of binary text from a spawned process
//  */
// function parseLineEndingsWarning(error: Buffer): LineEndingsChange | undefined {
//   if (error.length === 0) {
//     return undefined
//   }
//
//   const errorText = error.toString('utf-8')
//   const match = lineEndingsChangeRegex.exec(errorText)
//   if (match) {
//     const from = parseLineEndingText(match[1])
//     const to = parseLineEndingText(match[2])
//     if (from && to) {
//       return {from, to}
//     }
//   }
//
//   return undefined
// }
//
// /**
//  * Utility function used by get(Commit|WorkingDirectory)Diff.
//  *
//  * Parses the output from a diff-like command that uses `--path-with-raw`
//  */
function diffFromRawDiffOutput(output: Buffer): IRawDiff {
  // for now we just assume the diff is UTF-8, but given we have the raw buffer
  // we can try and convert this into other encodings in the future
  const result = output.toString('utf-8')

  const pieces = result.split('\0')
  const parser = new DiffParser()
  return parser.parse(forceUnwrap(`Invalid diff output`, pieces.at(-1)))
}

async function buildDiff(
  buffer: Buffer,
  gitRepositoryService: GitRepositoryService,
  file: FileChange,
  oldestCommitish: string,
  lineEndingsChange?: LineEndingsChange
) {
  // if (file.status.submoduleStatus !== undefined) {
  //   return buildSubmoduleDiff(
  //     buffer,
  //     repository,
  //     file,
  //     file.status.submoduleStatus
  //   )
  // }

  if (!isValidBuffer(buffer)) {
    // the buffer's diff is too large to be renderable in the UI
    return {kind: DiffType.Unrenderable}
  }

  const diff = diffFromRawDiffOutput(buffer)

  if (isBufferTooLarge(buffer) || isDiffTooLarge(diff)) {
    // we don't want to render by default
    // but we keep it as an option by
    // passing in text and hunks
    const largeTextDiff: ILargeTextDiff = {
      kind: DiffType.LargeText,
      text: diff.contents,
      hunks: diff.hunks,
      lineEndingsChange,
      maxLineNumber: diff.maxLineNumber,
      hasHiddenBidiChars: diff.hasHiddenBidiChars,
    }

    return largeTextDiff
  }

  return convertDiff(file, diff, oldestCommitish, lineEndingsChange)
}

//
// /**
//  * Retrieve the binary contents of a blob from the object database
//  *
//  * Returns an image object containing the base64 encoded string,
//  * as <img> tags support the data URI scheme instead of
//  * needing to reference a file:// URI
//  *
//  * https://en.wikipedia.org/wiki/Data_URI_scheme
//  */
export async function getBlobImage(
  gitRepositoryService: GitRepositoryService,
  git: (args?: string[]) => Observable<string>,
  path: string,
  commitish: string
) {
  const extension = Path.extname(path)
  return getBlobContents(gitRepositoryService, commitish, path)
    .pipe(map(contents => new Buffer(contents)), map(contents => new Image(
      contents.buffer,
      contents.toString('base64'),
      getMediaType(extension),
      contents.length
    )))
}

//
// /**
//  * Retrieve the binary contents of a blob from the working directory
//  *
//  * Returns an image object containing the base64 encoded string,
//  * as <img> tags support the data URI scheme instead of
//  * needing to reference a file:// URI
//  *
//  * https://en.wikipedia.org/wiki/Data_URI_scheme
//  */
// // export async function getWorkingDirectoryImage(
// //   git: (args?: string[]) => Observable<string>,
// //   file: FileChange
// // ): Promise<Image> {
// //   const contents = await readFile(Path.join( file.path))
// //   return new Image(
// //     contents.buffer,
// //     contents.toString('base64'),
// //     getMediaType(Path.extname(file.path)),
// //     contents.length
// //   )
// // }

/**
 * List the modified binary files' paths in the given repository
 *
 * @param git
 * @param ref ref (sha, branch, etc) to compare the working index against
 *
 * if you're mid-merge pass `'MERGE_HEAD'` to ref to get a diff of `HEAD` vs `MERGE_HEAD`,
 * otherwise you should probably pass `'HEAD'` to get a diff of the working tree vs `HEAD`
 * @param conflictedFilesInIndex
 */
export const getBinaryPaths = (git: (args?: string[]) => Observable<string>, ref: string, conflictedFilesInIndex?: ReadonlyArray<IStatusEntry>) =>
  forkJoin([getDetectedBinaryFiles(git, ref), getFilesUsingBinaryMergeDriver(git)])
    .pipe(map(([detectedBinaryFiles, conflictedFilesUsingBinaryMergeDriver]) => [...new Set([...detectedBinaryFiles, ...conflictedFilesUsingBinaryMergeDriver])]))

/**
 * Runs diff --numstat to get the list of files that have changed and which
 * Git have detected as binary files
 */
const getDetectedBinaryFiles = (git: (args?: string[]) => Observable<string>, ref: string) =>
  git(['diff', '--numstat', '-z', ref])
    .pipe(map(diff => Array.from(diff.matchAll(binaryListRegex), m => m[1])));

const binaryListRegex = /-\t-\t(?:\0.+\0)?([^\0]*)/gi

const logParser = createLogParser({path: '', attr: '', value: ''})

const getFilesUsingBinaryMergeDriver = (git: (args?: string[]) => Observable<string>): Observable<string[]> =>
  git(['check-attr', '--stdin', '-z', 'merge'])
    .pipe(map(r =>
      logParser.parse(r)
        .filter(x => x.attr === 'merge' && x.value === 'binary')
        .map(x => x.path)));

/** How many new lines will be added to a diff hunk by default. */
export const DefaultDiffExpansionStep = 20

/**
 * Calculates whether or not a hunk header can be expanded up, down, both, or if
 * the space represented by the hunk header is short and expansion there would
 * mean merging with the hunk above.
 *
 * @param hunkIndex     Index of the hunk to evaluate within the whole diff.
 * @param hunkHeader    Header of the hunk to evaluate.
 * @param previousHunk  Hunk previous to the one to evaluate. Null if the
 *                      evaluated hunk is the first one.
 */
export function getHunkHeaderExpansionType(
  hunkIndex: number,
  hunkHeader: DiffHunkHeader,
  previousHunk: DiffHunk | null
): DiffHunkExpansionType {
  const distanceToPrevious =
    previousHunk === null
      ? Infinity
      : hunkHeader.oldStartLine -
      previousHunk.header.oldStartLine -
      previousHunk.header.oldLineCount

  // In order to simplify the whole logic around expansion, only the hunk at the
  // top can be expanded up exclusively, and only the hunk at the bottom (the
  // dummy one, see getTextDiffWithBottomDummyHunk) can be expanded down
  // exclusively.
  // The rest of the hunks can be expanded both ways, except those which are too
  // short and therefore the direction of expansion doesn't matter.
  if (hunkIndex === 0) {
    // The top hunk can only be expanded if there is content above it
    if (hunkHeader.oldStartLine > 1 && hunkHeader.newStartLine > 1) {
      return DiffHunkExpansionType.Up
    } else {
      return DiffHunkExpansionType.None
    }
  } else if (distanceToPrevious <= DefaultDiffExpansionStep) {
    return DiffHunkExpansionType.Short
  } else {
    return DiffHunkExpansionType.Both
  }
}

function getOldPathOrDefault(file: FileChange): string {
  throw new Error("Function not implemented.");
}

