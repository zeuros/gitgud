import {describe, expect, it} from 'vitest';
import {layoutGraph} from './graph-layout';
import {RefType} from '../enums/ref-type.enum';
import {type DisplayRef} from '../lib/github-desktop/model/display-ref';

// Log from 'sha:parent1,parent2' entries, children first (git log --date-order)
const log = (...entries: string[]) => entries.map((entry, row) => {
  const [sha, parents] = entry.split(':');
  return {sha, parentSHAs: parents ? parents.split(',') : [], refType: RefType.COMMIT, row} as DisplayRef;
});
const columns = (commits: DisplayRef[]) => Object.fromEntries(commits.map(c => [c.sha, c.lane]));

describe('layoutGraph', () => {
  it('keeps a linear history in one column', () => {
    const commits = log('c:b', 'b:a', 'a');
    layoutGraph(commits, commits[0]);
    expect(columns(commits)).toEqual({c: 0, b: 0, a: 0});
  });

  it('keeps the main branch on the left even when another branch has newer commits', () => {
    //  f    feature, newer
    //  | m  main (HEAD)
    //  |/
    //  b
    const commits = log('f:b', 'm:b', 'b');
    const {edges} = layoutGraph(commits, commits[1]);
    expect(columns(commits)).toEqual({f: 1, m: 0, b: 0});
    // The feature lane ends sideways into b
    expect(edges.find(e => e.childRow == 0)!.laneCol).toBe(1);
  });

  it('continues the leftmost lane on a branching point', () => {
    const commits = log('x:b', 'y:b', 'b');
    layoutGraph(commits);
    expect(columns(commits)).toEqual({x: 0, y: 1, b: 0});
  });

  it('draws a merged branch in its own lane, down to its fork point', () => {
    //  m      merge (HEAD)
    //  |\
    //  | f2
    //  | f1
    //  a |
    //  |/
    //  b
    const commits = log('m:a,f2', 'f2:f1', 'f1:b', 'a:b', 'b');
    const {edges} = layoutGraph(commits, commits[0]);
    expect(columns(commits)).toEqual({m: 0, f2: 1, f1: 1, a: 0, b: 0});
    expect(edges.find(e => e.childRow == 0 && e.parentRow == 1)!.laneCol).toBe(1);
  });

  it("doesn't reuse a lane on the row it was freed", () => {
    //  x         tip (lane 1)
    //  | m       HEAD (lane 0)
    //  |/
    //  b         ends lane 1, merges z: z can't take lane 1 or x's line would look like it goes on to z
    //  |\
    //  | z
    //  a
    const commits = log('x:b', 'm:b', 'b:a,z', 'z:a', 'a');
    layoutGraph(commits, commits[1]);
    expect(columns(commits)).toEqual({x: 1, m: 0, b: 0, z: 2, a: 0});
  });

  it('ignores parents missing from the log (truncated history)', () => {
    const commits = log('c:b', 'b:missing');
    const {edges} = layoutGraph(commits, commits[0]);
    expect(columns(commits)).toEqual({c: 0, b: 0});
    expect(edges).toHaveLength(1);
  });
});
