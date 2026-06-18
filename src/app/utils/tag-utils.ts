import {type GitTag} from '../models/git-tag';
import {groupBy} from 'lodash-es';
import {type TreeNode} from 'primeng/api';

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

export const toTagTree = (tags: LocalAndDistantTagWithName[]): TreeNode<LocalAndDistantTagWithName>[] => {
  const nodeMap = new Map<string, TreeNode<LocalAndDistantTagWithName>>();
  const roots: TreeNode<LocalAndDistantTagWithName>[] = [];

  const sorted = [...tags].sort((a, b) => b.name.localeCompare(a.name, undefined, {numeric: true}));

  sorted.forEach(tag => {
    const parts = tag.name.split('/').map((_, i, arr) => arr.slice(0, i + 1).join('/'));

    parts.forEach((key, i) => {
      if (nodeMap.has(key)) return;

      const isLeaf = i === parts.length - 1;
      const node: TreeNode<LocalAndDistantTagWithName> = isLeaf
        ? {key, icon: 'fa fa-tag', label: key.split('/').pop(), data: tag, leaf: true, expanded: true, selectable: true}
        : {key, icon: 'pi pi-folder', label: key.split('/').pop(), leaf: false, expanded: true, selectable: false, children: []};

      nodeMap.set(key, node);

      if (i === 0) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(parts[i - 1])!;
        parent.children = [...(parent.children ?? []), node];
      }
    });
  });

  return roots;
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
