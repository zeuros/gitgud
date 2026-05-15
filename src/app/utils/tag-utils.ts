import {type GitTag} from '../models/git-tag';

export type LocalAndDistantTag = [local: GitTag | null, distant: GitTag | null];
export type LocalAndDistantTagWithName = { local: GitTag | null, distant: GitTag | null, name: string };

export const toLocalAndDistantTagPairs = (localTags: GitTag[], remoteTags: GitTag[]): LocalAndDistantTag[] => {
  const allNames = new Set([...localTags.map(t => t.name), ...remoteTags.map(t => t.name)]);
  return Array.from(allNames).map(name => [
    localTags.find(t => t.name === name) ?? null,
    remoteTags.find(t => t.name === name) ?? null,
  ] as LocalAndDistantTag);
};

export const toLocalAndDistantTagWithName = ([local, distant]: LocalAndDistantTag): LocalAndDistantTagWithName => ({local, distant, name: (local ?? distant)!.name});