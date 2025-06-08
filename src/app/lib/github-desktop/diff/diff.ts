import {IRawDiff} from '../model/diff/raw-diff';
import {GitRepository} from '../../../models/git-repository';
import {AppFileStatusKind, FileChange} from '../model/status';
import {DiffType, ILargeTextDiff, LineEndingsChange} from '../model/diff/diff-data';
import {GitRepositoryService} from '../../../services/git-repository.service';
import {forkJoin, map, Observable} from 'rxjs';
import * as Path from 'node:path';
import {getBlobContents} from '../show';
import {Image} from '../model/diff/image';
import {IStatusEntry} from '../status-parser';
import {createLogParser} from '../git-delimiter-parser';
import {DiffParser} from './diff-parser';
import {forceUnwrap} from '../throw-ex';
import {isDiffTooLarge, isStringTooLarge, isValidBuffer} from './diff-utils';
import {convertDiff} from './diff-binary-image';
import {buildDiff} from './diff-builder';

/**
 * Render the diff between two branches with --merge-base for a file
 * (Show what would be the result of merge)
 */
export async function getBranchMergeBaseDiff(
  gitRepositoryService: GitRepositoryService,
  file: FileChange,
  baseBranchName: string,
  comparisonBranchName: string,
  hideWhitespaceInDiff: boolean = false,
  latestCommit: string,
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
  ];

  if (
    file.status.kind === AppFileStatusKind.Renamed ||
    file.status.kind === AppFileStatusKind.Copied
  ) {
    args.push(file.status.oldPath);
  }

  return gitRepositoryService.git(args).pipe(map(result => buildDiff(result, file, latestCommit)));
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
//   return gitRepositoryService.git(args).pipe(map(rangeDiffRaw => buildDiff(rangeDiffRaw, repository, file, latestCommit)))
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


/**
 * Map a given file extension to the related data URL media type
 */
function getMediaType(extension: string) {
  if (extension === '.png') return 'image/png';
  if (extension === '.jpg' || extension === '.jpeg') 'image/jpg';
  if (extension === '.gif') 'image/gif';
  if (extension === '.ico') 'image/x-icon';
  if (extension === '.webp') 'image/webp';
  if (extension === '.bmp') 'image/bmp';
  if (extension === '.avif') 'image/avif';
  if (extension === '.dds') 'image/vnd-ms.dds';

  // fallback value as per the spec
  return 'text/plain';
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
// function parseLineEndingsWarning(error: string): LineEndingsChange | undefined {
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
  commitish: string,
) {
  return getBlobContents(gitRepositoryService, commitish, path)
    .pipe(map(contents => new Image(
      contents,
      btoa(contents),
      getMediaType(Path.extname(path)),
      contents.length,
    )));
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
    .pipe(map(([detectedBinaryFiles, conflictedFilesUsingBinaryMergeDriver]) => [...new Set([...detectedBinaryFiles, ...conflictedFilesUsingBinaryMergeDriver])]));

/**
 * Runs diff --numstat to get the list of files that have changed and which
 * Git have detected as binary files
 */
const getDetectedBinaryFiles = (git: (args?: string[]) => Observable<string>, ref: string) =>
  git(['diff', '--numstat', '-z', ref])
    .pipe(map(diff => Array.from(diff.matchAll(binaryListRegex), m => m[1])));

const binaryListRegex = /-\t-\t(?:\0.+\0)?([^\0]*)/gi;

const logParser = createLogParser({path: '', attr: '', value: ''});

const getFilesUsingBinaryMergeDriver = (git: (args?: string[]) => Observable<string>): Observable<string[]> =>
  git(['check-attr', '--stdin', '-z', 'merge'])
    .pipe(map(r =>
      logParser.parse(r)
        .filter(x => x.attr === 'merge' && x.value === 'binary')
        .map(x => x.path)));

function getOldPathOrDefault(file: FileChange): string {
  throw new Error('Function not implemented.');
}

