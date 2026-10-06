/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

// Undo / redo are derived from the HEAD reflog alone, so they survive restarts and follow actions done outside the app.
// Our own moves are tagged through GIT_REFLOG_ACTION ("gitgud undo: <original subject>"), which lets the reflog be
// read back as an editor-like history: an undo cancels the action below it, a redo cancels an undo.
//
// Actions that don't move HEAD (stashes, branches, tags) leave no trace there, so the app journals them itself as
// entries that keep HEAD in place ("gitgud did: <json>"), holding what it takes to revert them.

export interface ReflogEntry {
  sha: string;
  subject: string;
}

export type UndoKind =
  'checkout' | 'commit' | 'reset' | 'merge' | 'pull' | 'cherry-pick' | 'revert' | 'rebase' | 'rebase-in-progress' | 'journal' | 'other';

export type JournalPayload =
  | {t: 'stash' | 'stash-pop' | 'stash-drop'; sha: string; msg: string}
  | {t: 'stash-apply'; sha: string}
  | {t: 'branch-create'; name: string; sha: string}
  | {t: 'branch-delete'; name: string; sha: string; upstream?: string}
  | {t: 'branch-rename'; from: string; to: string}
  | {t: 'branch-move'; name: string; from: string; to: string}
  | {t: 'tag-delete'; name: string; sha: string};


interface Action {
  kind: UndoKind;
  marker?: 'undo' | 'redo';
  // Reflog subject of the user action this entry is about (the undone / redone one for our own entries)
  subject: string;
  sha: string;
  // HEAD before the action, missing for the oldest entry of the reflog
  prevSha?: string;
}

export interface UndoStep {
  args: string[];
  // Git command whose output is fed to `args` on stdin. Nothing is run when it outputs nothing
  inputFrom?: string[];
  // Failing is fine
  optional?: boolean;
}

export interface UndoPlan {
  label: string;
  steps: UndoStep[];
  // To run when `steps` fail
  fallbackSteps?: UndoStep[];
  marker: 'undo' | 'redo';
  // For steps moving HEAD: the GIT_REFLOG_ACTION making git itself log them as this undo / redo
  reflogAction?: string;
  // For a journaled action: what to log once the steps are done
  journal?: JournalPayload;
}

/** What to read before and after a git command to be able to revert it later */
export interface JournalRecorder {
  before?: Record<string, string[]>;
  after?: Record<string, string[]>;
  // Undefined when the command turned out to change nothing worth undoing
  payload: (before: Record<string, string | undefined>, after: Record<string, string | undefined>) => JournalPayload | undefined;
}

export const REFLOG_FORMAT = '%H\t%gs';
// Enough to walk past long undo / redo chains and rebases of many commits
export const REFLOG_DEPTH = 500;

const MARKER = /^gitgud (undo|redo): /;
const JOURNAL = 'did: ';
const CHECKOUT = /^checkout: moving from (\S+) to (\S+)$/;
const REBASE_END = /^[^:]*rebase[^:]*\((finish|abort)\):/;
const REBASE_START = /^[^:]*rebase[^:]*\(start\):/;
const REBASE_STEP = /^[^:]*rebase[^:]*\(\w+\):/;

/** Parses `git reflog --format=REFLOG_FORMAT`, newest entry first */
export const parseReflog = (stdout: string): ReflogEntry[] =>
  stdout.split('\n').filter(line => line.length).map(line => {
    const [sha, ...subject] = line.split('\t');
    return {sha, subject: subject.join('\t')};
  });

/** Reflog subject of a journaled action, or of its undo / redo */
export const journalSubject = (payload: JournalPayload, marker?: 'undo' | 'redo') =>
  `gitgud ${marker ? `${marker}: ` : ''}${JOURNAL}${JSON.stringify(payload)}`;

const parseJournal = (subject: string): JournalPayload | undefined => {
  try {
    return JSON.parse(subject.slice(JOURNAL.length));
  } catch {
    return undefined;
  }
};

const kindOf = (subject: string): UndoKind => {
  if (subject.startsWith(JOURNAL)) return parseJournal(subject) ? 'journal' : 'other';
  if (CHECKOUT.test(subject)) return 'checkout';
  if (subject.startsWith('commit (merge):') || subject.startsWith('merge ')) return 'merge';
  if (subject.startsWith('commit')) return 'commit';
  if (subject.startsWith('reset:')) return 'reset';
  if (subject.startsWith('pull')) return 'pull';
  if (subject.startsWith('cherry-pick')) return 'cherry-pick';
  if (subject.startsWith('revert')) return 'revert';
  if (REBASE_END.test(subject)) return 'rebase';
  return 'other';
};

// `git reset` appends ": moving to <rev>" or ": updating HEAD" to GIT_REFLOG_ACTION, `git checkout` uses it as is
const originalSubject = (subject: string) => {
  if (!MARKER.test(subject)) return subject.replace(/^gitgud did: /, JOURNAL);
  const original = subject.replace(MARKER, '');
  return CHECKOUT.test(original) || original.startsWith(JOURNAL) ? original : original.replace(/: (moving to \S+|updating HEAD)$/, '');
};

/** Groups reflog entries into user-level actions (a whole rebase is one), dropping those that left HEAD where it was */
export const toActions = (reflog: ReflogEntry[]): Action[] => {
  const actions: Action[] = [];

  for (let i = 0; i < reflog.length; i++) {
    const {sha, subject} = reflog[i];
    const marker = subject.match(MARKER)?.[1] as Action['marker'];
    let last = i;

    if (!marker && REBASE_STEP.test(subject)) {
      const start = REBASE_END.test(subject) ? reflog.findIndex((e, j) => j > i && REBASE_START.test(e.subject)) : -1;
      if (start == -1) {
        actions.push({kind: 'rebase-in-progress', subject, sha});
        continue;
      }
      last = start;
    }

    const original = originalSubject(subject);
    const action: Action = {kind: kindOf(original), marker, subject: original, sha, prevSha: reflog[last + 1]?.sha};
    i = last;

    // e.g. `git stash` and unstaging log "reset: moving to HEAD", an aborted rebase ends where it started
    if (!marker && action.kind != 'checkout' && action.kind != 'journal' && action.prevSha == sha) continue;
    actions.push(action);
  }

  return actions;
};

const describeJournal = (payload: JournalPayload) => {
  switch (payload.t) {
    case 'stash':
      return 'stash';
    case 'stash-pop':
      return `pop of stash "${payload.msg}"`;
    case 'stash-apply':
      return 'stash apply';
    case 'stash-drop':
      return `drop of stash "${payload.msg}"`;
    case 'branch-create':
      return `creation of branch ${payload.name}`;
    case 'branch-delete':
      return `deletion of branch ${payload.name}`;
    case 'branch-rename':
      return `rename of ${payload.from} to ${payload.to}`;
    case 'branch-move':
      return `move of branch ${payload.name}`;
    case 'tag-delete':
      return `deletion of tag ${payload.name}`;
  }
};

const describe = ({kind, subject}: Action) => {
  const body = subject.replace(/^[^:]+:\s*/, '');
  switch (kind) {
    case 'journal':
      return describeJournal(parseJournal(subject)!);
    case 'checkout':
      return `checkout of ${subject.match(CHECKOUT)![2]}`;
    case 'commit':
      return subject.startsWith('commit (amend)') ? `amend: ${body}` : `commit: ${body}`;
    case 'merge':
      return subject.startsWith('commit (merge)') ? `merge: ${body}` : subject.replace(/:.*$/, '');
    case 'cherry-pick':
      return `cherry-pick: ${body}`;
    case 'revert':
      return `revert: ${body.replace(/^Revert /, '')}`;
    case 'reset':
      return `reset to ${body.replace(/^moving to /, '')}`;
    case 'pull':
      return 'pull';
    case 'rebase':
      return 'rebase';
    default:
      return 'last action';
  }
};

// A stash is addressed by position, which moves around: resolved from its sha when the step runs
const stashRef = (sha: string) => `{stash:${sha}}`;

// Replaces the stash placeholders of a step by `stash@{n}`, given `git stash list --format=%H`
const resolveStashRefs = (args: string[], stashShas: string[]) =>
  args.map(arg => arg.replace(/^\{stash:(\w+)}$/, (_, sha) => {
    const index = stashShas.indexOf(sha);
    if (index == -1) throw new Error('This stash no longer exists');
    return `stash@{${index}}`;
  }));

const needsStashList = (steps: UndoStep[]) => steps.some(({args}) => args.some(arg => arg.startsWith('{stash:')));

// Takes out of the working directory what applying a stash put there, and nothing else: git refuses if those
// changes were edited since
const unapplyStash = (sha: string): UndoStep[] => [
  {args: ['apply', '-R'], inputFrom: ['stash', 'show', '-p', '--binary', '--include-untracked', sha]},
  // What came back staged is still in the index
  {args: ['reset', '-q', '--pathspec-from-file=-'], inputFrom: ['diff', '--name-only', `${sha}^1`, sha]},
];

const storeStash = ({sha, msg}: {sha: string; msg: string}): UndoStep => ({args: ['stash', 'store', '-m', msg, sha]});

const journalSteps = (payload: JournalPayload, forward: boolean): UndoStep[] => {
  switch (payload.t) {
    case 'stash':
      // Stashing again would make another stash, that the actions to redo next wouldn't know
      return forward ? [...unapplyStash(payload.sha), storeStash(payload)] : [{args: ['stash', 'pop', '--index', stashRef(payload.sha)]}];
    case 'stash-pop':
      return forward ? [{args: ['stash', 'pop', stashRef(payload.sha)]}] : [...unapplyStash(payload.sha), storeStash(payload)];
    case 'stash-apply':
      return forward ? [{args: ['stash', 'apply', payload.sha]}] : unapplyStash(payload.sha);
    case 'stash-drop':
      return forward ? [{args: ['stash', 'drop', stashRef(payload.sha)]}] : [storeStash(payload)];
    case 'branch-create':
      return forward ? [{args: ['branch', payload.name, payload.sha]}] : [{args: ['branch', '-D', payload.name]}];
    case 'branch-delete':
      return forward
        ? [{args: ['branch', '-D', payload.name]}]
        : [
          {args: ['branch', payload.name, payload.sha]},
          ...(payload.upstream ? [{args: ['branch', `--set-upstream-to=${payload.upstream}`, payload.name], optional: true}] : []),
        ];
    case 'branch-rename':
      return [{args: forward ? ['branch', '-m', payload.from, payload.to] : ['branch', '-m', payload.to, payload.from]}];
    case 'branch-move':
      // Refuses to move the checked out branch, which would leave the working directory behind
      return [{args: ['branch', '-f', payload.name, forward ? payload.to : payload.from]}];
    case 'tag-delete':
      return forward ? [{args: ['tag', '-d', payload.name]}] : [{args: ['update-ref', `refs/tags/${payload.name}`, payload.sha]}];
  }
};

// Puts things back as they were before `action`
const restoreBefore = (action: Action, verb: 'Undo' | 'Redo'): UndoPlan | undefined => {
  const marker = verb == 'Undo' ? 'undo' : 'redo';
  const label = `${verb} ${describe(action)}`;
  const plan = (args: string[], fallbackArgs?: string[]): UndoPlan =>
    ({label, steps: [{args}], fallbackSteps: fallbackArgs && [{args: fallbackArgs}], marker, reflogAction: `gitgud ${marker}: ${action.subject}`});

  if (action.kind == 'journal') {
    const payload = parseJournal(action.subject)!;
    // Our undo went backwards, reverting it is doing the action again
    const forward = action.marker == 'undo';
    return {
      label,
      steps: journalSteps(payload, forward),
      marker,
      journal: payload,
    };
  }

  if (action.kind == 'checkout') {
    const [, from, to] = action.subject.match(CHECKOUT)!;
    // Our undo of a checkout went the other way round
    return plan(['checkout', action.marker == 'undo' ? to : from]);
  }

  if (!action.prevSha || action.kind == 'rebase-in-progress') return undefined;

  // --keep is --hard minus the data loss: it keeps local changes and refuses to overwrite them
  const keep = ['reset', '--keep', action.prevSha];

  // Undoing a commit hands its changes back staged. Redoing it takes them back wherever they ended up: still
  // there (--keep refuses, the files are already right), or discarded since (--keep restores them)
  if (action.kind == 'commit') return action.marker == 'undo' ? plan(keep, ['reset', '--mixed', action.prevSha]) : plan(['reset', '--soft', action.prevSha]);
  // The reflog doesn't tell --hard from --soft / --mixed resets. After the latter the files still hold what the
  // commits held, which --keep refuses to overwrite: moving HEAD and the index alone is then all there is to do
  return action.kind == 'reset' ? plan(keep, ['reset', '--mixed', action.prevSha]) : plan(keep);
};

/** The action a click on undo reverts: the newest one not already undone */
export const planUndo = (reflog: ReflogEntry[]): UndoPlan | undefined => {
  let undone = 0;
  for (const action of toActions(reflog)) {
    if (action.marker == 'undo') undone++;
    else if (undone > 0) undone--;
    else return restoreBefore(action, 'Undo');
  }
  return undefined;
};

/** The undo a click on redo reverts: the newest one not already redone, as long as nothing else happened since */
export const planRedo = (reflog: ReflogEntry[]): UndoPlan | undefined => {
  let redone = 0;
  for (const action of toActions(reflog)) {
    if (action.marker == 'redo') redone++;
    else if (action.marker != 'undo') return undefined;
    else if (redone > 0) redone--;
    else return restoreBefore(action, 'Redo');
  }
  return undefined;
};

const TOP_STASH = ['rev-parse', '-q', '--verify', 'refs/stash'];
const branchSha = (name: string) => ['rev-parse', '-q', '--verify', `refs/heads/${name}`];
const stashSubject = (ref: string) => ['log', '-g', '-1', '--format=%gs', ref];
const isName = (arg: string | undefined): arg is string => !!arg && !arg.startsWith('-');

// A branch moved without being checked out. When it is, HEAD moved along and the reflog already tells
const branchMoved = (name: string): JournalRecorder => ({
  before: {sha: branchSha(name), head: ['symbolic-ref', '-q', '--short', 'HEAD']},
  after: {sha: branchSha(name)},
  payload: ({sha: from, head}, {sha: to}) => {
    if (!to || from == to || head == name) return undefined;
    return from ? {t: 'branch-move', name, from, to} : {t: 'branch-create', name, sha: to};
  },
});

/** Tells how to journal a git command the reflog of HEAD won't show, if it is one */
export const journalFor = (args: string[]): JournalRecorder | undefined => {
  const [command, a, b, c] = args;

  if (command == 'stash') {
    const ref = b ?? 'stash@{0}';
    const target = {sha: ['rev-parse', '-q', '--verify', ref], msg: stashSubject(ref)};
    if (a == 'pop') return {before: target, payload: ({sha, msg}) => sha ? {t: 'stash-pop', sha, msg: msg ?? ''} : undefined};
    if (a == 'drop') return {before: target, payload: ({sha, msg}) => sha ? {t: 'stash-drop', sha, msg: msg ?? ''} : undefined};
    if (a == 'apply') return {before: target, payload: ({sha}) => sha ? {t: 'stash-apply', sha} : undefined};
    if (a === undefined || a == 'push' || a.startsWith('-'))
      return {
        before: {sha: TOP_STASH},
        after: {sha: TOP_STASH, msg: stashSubject('stash@{0}')},
        // Nothing gets stashed when there are no local changes
        payload: ({sha: previous}, {sha, msg}) => sha && sha != previous ? {t: 'stash', sha, msg: msg ?? ''} : undefined,
      };
  }

  if (command == 'branch') {
    if ((a == '-d' || a == '-D') && isName(b) && c === undefined)
      return {
        before: {sha: branchSha(b), upstream: ['rev-parse', '-q', '--abbrev-ref', `${b}@{upstream}`]},
        payload: ({sha, upstream}) => sha ? {t: 'branch-delete', name: b, sha, upstream} : undefined,
      };
    if (a == '-m' && isName(b) && isName(c)) return {payload: () => ({t: 'branch-rename', from: b, to: c})};
    if (isName(a) && (b === undefined || isName(b)) && c === undefined)
      return {after: {sha: branchSha(a)}, payload: (_, {sha}) => sha ? {t: 'branch-create', name: a, sha} : undefined};
  }

  if (command == 'tag' && a == '-d' && isName(b) && c === undefined)
    return {
      before: {sha: ['rev-parse', '-q', '--verify', `refs/tags/${b}`]},
      payload: ({sha}) => sha ? {t: 'tag-delete', name: b, sha} : undefined,
    };

  // `git fetch <remote> <src>:<branch>` fast-forwards a branch without checking it out
  if (command == 'fetch' && isName(a) && b?.includes(':') && c === undefined) {
    const branch = b.split(':')[1];
    if (branch && !branch.startsWith('refs/')) return branchMoved(branch);
  }

  if (command == 'update-ref' && a?.startsWith('refs/heads/') && isName(b) && c === undefined) return branchMoved(a.slice('refs/heads/'.length));

  return undefined;
};

/** Runs git in the repository, failing when git does. `reflogAction` is the GIT_REFLOG_ACTION to run it with */
export type GitRunner = (args: string[], options?: {reflogAction?: string; input?: string}) => Promise<string>;

const tryGit = (git: GitRunner, args: string[]) => git(args).then(out => out.trim() || undefined, () => undefined);

const capture = async (git: GitRunner, wanted: Record<string, string[]> = {}) => {
  const captured: Record<string, string | undefined> = {};
  for (const [key, args] of Object.entries(wanted)) captured[key] = await tryGit(git, args);
  return captured;
};

// Logs an entry on HEAD without moving it. Best effort: the action it tells about is already done
const writeMarker = async (git: GitRunner, subject: string) => {
  const head = await tryGit(git, ['rev-parse', '-q', '--verify', 'HEAD']);
  if (!head) return;
  // `reflog write` came with git 2.51; update-ref logs nothing on a detached HEAD
  await git(['reflog', 'write', 'HEAD', head, head, subject])
    .catch(() => git(['update-ref', '-m', subject, 'HEAD', 'HEAD']))
    .catch(() => undefined);
};

/** Runs a git command of the user, journaling it when the reflog of HEAD wouldn't show it */
export const runJournaled = async <T>(args: string[], run: () => Promise<T>, git: GitRunner): Promise<T> => {
  const recorder = journalFor(args);
  if (!recorder) return run();

  const before = await capture(git, recorder.before);
  const result = await run();
  const payload = recorder.payload(before, await capture(git, recorder.after));
  if (payload) await writeMarker(git, journalSubject(payload));
  return result;
};

const runSteps = async (steps: UndoStep[], git: GitRunner, reflogAction?: string) => {
  const stashShas = needsStashList(steps) ? (await git(['stash', 'list', '--format=%H'])).split('\n').map(sha => sha.trim()) : [];
  for (const {args, inputFrom, optional} of steps) {
    try {
      const input = inputFrom && await git(inputFrom);
      if (input?.trim() !== '') await git(resolveStashRefs(args, stashShas), {reflogAction, input});
    } catch (e) {
      if (!optional) throw e;
    }
  }
};

export const runPlan = async ({steps, fallbackSteps, marker, reflogAction, journal}: UndoPlan, git: GitRunner) => {
  try {
    await runSteps(steps, git, reflogAction);
  } catch (e) {
    if (!fallbackSteps) throw e;
    await runSteps(fallbackSteps, git, reflogAction);
  }
  if (journal) await writeMarker(git, journalSubject(journal, marker));
};
