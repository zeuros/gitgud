import {throwEx} from "../../../utils/utils";

/**
 * Possible statuses of an entry in Git, see the git diff-index
 * man page for additional details.
 */
export enum IndexStatus {
  Unknown = 'X',
  Added = 'A',
  Copied = 'C',
  Deleted = 'D',
  Modified = 'M',
  Renamed = 'R',
  TypeChanged = 'T',
  Unmerged = 'U',
}

/**
 * Index statuses excluding renames and copies.
 *
 * Used when invoking diff-index with rename detection explicitly turned
 * off.
 */
export type NoRenameIndexStatus =
  | IndexStatus.Added
  | IndexStatus.Deleted
  | IndexStatus.Modified
  | IndexStatus.TypeChanged
  | IndexStatus.Unmerged
  | IndexStatus.Unknown

const getIndexStatus = (status: string): IndexStatus | never =>
  Object.values(IndexStatus).includes(status as IndexStatus)
    ? status as IndexStatus
    : throwEx(`Wrong IndexStatus: ${status}`);

export function getNoRenameIndexStatus(status: string): NoRenameIndexStatus | undefined {
  const parsed = getIndexStatus(status)

  switch (parsed) {
    case IndexStatus.Copied:
    case IndexStatus.Renamed:
      throw new Error(`Invalid index status for no-rename index status: ${parsed}`)
  }

  return parsed
}

/** The SHA for the null tree. */
export const NullTreeSHA = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'