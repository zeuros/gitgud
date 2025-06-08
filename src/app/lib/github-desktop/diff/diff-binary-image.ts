import {DiffType, IDiff, IImageDiff, LineEndingsChange} from '../model/diff/diff-data';
import {IRawDiff} from '../model/diff/raw-diff';
import {AppFileStatusKind, CommittedFileChange, FileChange, WorkingDirectoryFileChange} from '../model/status';
import {Image} from '../model/diff/image';
import {fileName} from '../../../utils/utils';

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
]);


export function convertDiff(
  file: FileChange,
  diff: IRawDiff,
  oldestCommitish: string,
  lineEndingsChange?: LineEndingsChange,
): IDiff {
  const extension = fileName(file.path)!.toLowerCase();

  if (diff.isBinary) {
    // some extension we don't know how to parse, never mind
    if (!imageFileExtensions.has(extension)) {
      return {
        kind: DiffType.Binary,
      };
    } else {
      return getImageDiff(file, oldestCommitish);
    }
  }

  return {
    kind: DiffType.Text,
    text: diff.contents,
    hunks: diff.hunks,
    lineEndingsChange,
    maxLineNumber: diff.maxLineNumber,
    hasHiddenBidiChars: diff.hasHiddenBidiChars,
  };
}


export function getImageDiff(
  file: FileChange,
  oldestCommitish: string,
): IImageDiff {
  let current: Image | undefined = undefined;
  let previous: Image | undefined = undefined;

  // Are we looking at a file in the working directory or a file in a commit?
  if (file instanceof WorkingDirectoryFileChange) {
    // No idea what to do about this, a conflicted binary (presumably) file.
    // Ideally we'd show all three versions and let the user pick but that's
    // a bit out of scope for now.
    if (file.status.kind === AppFileStatusKind.Conflicted) {
      return {kind: DiffType.Image};
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
  };
}