import {type GitTag} from '../models/git-tag';
import {groupBy} from 'lodash-es';

export type LocalAndDistantTagWithName = { local: GitTag | null, distant: GitTag | null, name: string, sha: string };

export const localAndDistantTagPairsByName = (localTags: GitTag[], remoteTags: GitTag[]): LocalAndDistantTagWithName[] => {
  const localByName = new Map(localTags.map(t => [t.name, t]));
  const distantByName = new Map(remoteTags.map(t => [t.name, t]));
  const allNames = new Set([...localByName.keys(), ...distantByName.keys()]);
  return Array.from(allNames).map(name => {
    const local = localByName.get(name) ?? null;
    const distant = distantByName.get(name) ?? null;
    const sha = (local ?? distant)!.sha;
    return {name, sha, local, distant};
  });
};

export const groupTagsByShaAndName = (localTags: GitTag[], remoteTags: GitTag[]): Map<string, LocalAndDistantTagWithName[]> => {
  const localSet = new Set(localTags);
  const allBySha = groupBy([...localTags, ...remoteTags], t => t.sha);
  return new Map(Object.entries(allBySha).map(([sha, shaGroup]) => [
    sha,
    Object.entries(groupBy(shaGroup, t => t.name)).map(([name, group]) => ({
      name,
      sha,
      local: group.find(t => localSet.has(t)) ?? null,
      distant: group.find(t => !localSet.has(t)) ?? null,
    })),
  ]));
};
