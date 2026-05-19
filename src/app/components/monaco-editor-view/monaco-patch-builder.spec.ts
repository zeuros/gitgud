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

import type {editor} from 'monaco-editor';
import {describe, expect, it} from 'vitest';
import {buildZeroContextPatch} from './monaco-patch-builder';

// ─── helpers ─────────────────────────────────────────────────────────────────

const model = (lines: string[]): editor.ITextModel =>
  ({getLineContent: (i: number) => lines[i - 1] ?? ''} as unknown as editor.ITextModel);

const change = (os: number, oe: number, ms: number, me: number): editor.ILineChange =>
  ({originalStartLineNumber: os, originalEndLineNumber: oe,
    modifiedStartLineNumber: ms, modifiedEndLineNumber: me} as unknown as editor.ILineChange);

const header = (p: string) => `--- a/${p}\n+++ b/${p}\n`;
const FILE = 'src/app/service.ts';

// ─── sample file ─────────────────────────────────────────────────────────────
//
// We simulate a TypeScript file that went through several edits.
// The line numbers below are 1-based and must stay consistent across both models.
//
// ORIGINAL (index / HEAD):           MODIFIED (working dir):
//  1  import {A} from './a';          1  import {A} from './a';
//  2  import {B} from './b';          2  import {B} from './b';
//  3                                  3  import {C} from './c';   ← inserted (pure insertion)
//  4  @Injectable()                   4  @Injectable()
//  5  export class MyService {        5  export class MyService {
//  6    private x = 1;                6    private x = 42;        ← modified (equal-count 1:1)
//  7    private y = 2;                7    private y = 99;        ← modified (equal-count 1:1)
//  8                                     (blank line removed)     ← deleted  (pure deletion)
//  9    foo() {                        8    foo() {
// 10      return this.x;              9      return this.x;
// 11    }                            10    }
// 12                                 11
// 13    bar() {                      12    bar() {
// 14      const a = 1;              ← replaced by 3 lines       ← unequal replacement (2→3)
// 15      const b = 2;              13      const a = 10;
//                                   14      const b = 20;
//                                   15      const c = 30;
// 16    }                           16    }
// 17  }                             17  }

const original = model([
  "import {A} from './a';",   //  1
  "import {B} from './b';",   //  2
  '',                          //  3  ← blank line that will be deleted
  '@Injectable()',             //  4
  'export class MyService {',  //  5
  '  private x = 1;',         //  6  ← will become 42
  '  private y = 2;',         //  7  ← will become 99
  '',                          //  8  ← blank line, pure deletion
  '  foo() {',                 //  9
  '    return this.x;',        // 10
  '  }',                       // 11
  '',                          // 12
  '  bar() {',                 // 13
  '    const a = 1;',          // 14  ← unequal replacement starts
  '    const b = 2;',          // 15  ← unequal replacement ends
  '  }',                       // 16
  '}',                         // 17
]);

const modified = model([
  "import {A} from './a';",   //  1
  "import {B} from './b';",   //  2
  "import {C} from './c';",   //  3  ← pure insertion (origEnd=0, origStart=3, mod 3)
  '@Injectable()',             //  4
  'export class MyService {',  //  5
  '  private x = 42;',        //  6  ← equal-count replacement (orig 6→6, mod 6→6)
  '  private y = 99;',        //  7  ← equal-count replacement (orig 7→7, mod 7→7)
                               //     blank line at orig 8 removed (pure deletion, modEnd=0)
  '  foo() {',                 //  8
  '    return this.x;',        //  9
  '  }',                       // 10
  '',                          // 11
  '  bar() {',                 // 12
  '    const a = 10;',         // 13  ← unequal replacement: orig 14-15 → mod 13-15
  '    const b = 20;',         // 14
  '    const c = 30;',         // 15
  '  }',                       // 16
  '}',                         // 17
]);

// Monaco ILineChange descriptors for the four distinct hunks above:
//
//  c_insert  — pure insertion:    origEnd=0 means "nothing removed"; insert before orig line 3
//  c_equal   — equal replacement: orig 6-7 ↔ mod 6-7 (2 lines → 2 lines)
//  c_delete  — pure deletion:     modEnd=0 means "nothing added";  orig line 8 removed
//  c_unequal — unequal replace:   orig 14-15 → mod 13-15 (2 lines → 3 lines)

const c_insert  = change(3,  0,  3,  3);   // pure insertion  at mod line 3
const c_equal   = change(6,  7,  6,  7);   // equal-count replacement
const c_delete  = change(8,  8,  8,  0);   // pure deletion   at orig line 8 (modStart=8 = first mod line after gap)
const c_unequal = change(14, 15, 13, 15);  // unequal replacement

const allChanges = [c_insert, c_equal, c_delete, c_unequal];

// ─── "Stage this line" / "Stage lines"  (stage=true, modified editor) ────────

describe('"Stage this line" / "Stage lines"  (stage=true)', () => {

  describe('pure insertion — import {C}', () => {
    it('Stage this line — stages the single inserted line', () => {
      expect(buildZeroContextPatch([c_insert], original, modified, 3, 3, FILE, true))
        .toBe(header(FILE) + '@@ -2,0 +3 @@\n+import {C} from \'./c\';\n');
    });
  });

  describe('equal-count replacement — private x and y', () => {
    it('Stage this line — stages only x=42 (single line)', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 6, FILE, true))
        .toBe(header(FILE) + '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n');
    });

    it('Stage this line — stages only y=99 (single line)', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 7, 7, FILE, true))
        .toBe(header(FILE) + '@@ -7 +7 @@\n-  private y = 2;\n+  private y = 99;\n');
    });

    it('Stage lines — stages both x and y as separate mini-hunks', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 7, FILE, true))
        .toBe(header(FILE) +
          '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n' +
          '@@ -7 +7 @@\n-  private y = 2;\n+  private y = 99;\n');
    });

    it('Stage lines — skips pure deletion change when selection covers it', () => {
      // c_delete has modEnd=0 — nothing to stage on the add side
      expect(buildZeroContextPatch([c_delete], original, modified, 6, 9, FILE, true))
        .toBeNull();
    });
  });

  describe('unequal-count replacement — const a/b → a/b/c', () => {
    it('Stage this line — stages only "const a = 10" but must remove both old lines atomically', () => {
      expect(buildZeroContextPatch([c_unequal], original, modified, 13, 13, FILE, true))
        .toBe(header(FILE) + '@@ -14,2 +13 @@\n-    const a = 1;\n-    const b = 2;\n+    const a = 10;\n');
    });

    it('Stage lines — stages "const a/b" but must remove both old lines atomically', () => {
      expect(buildZeroContextPatch([c_unequal], original, modified, 13, 14, FILE, true))
        .toBe(header(FILE) + '@@ -14,2 +13,2 @@\n-    const a = 1;\n-    const b = 2;\n+    const a = 10;\n+    const b = 20;\n');
    });

    it('Stage lines — stages all three new lines with all old lines removed', () => {
      expect(buildZeroContextPatch([c_unequal], original, modified, 13, 15, FILE, true))
        .toBe(header(FILE) + '@@ -14,2 +13,3 @@\n-    const a = 1;\n-    const b = 2;\n+    const a = 10;\n+    const b = 20;\n+    const c = 30;\n');
    });
  });

  describe('multiple hunks in one patch', () => {
    it('Stage lines — stages insertion + equal replacement together', () => {
      const patch = buildZeroContextPatch(allChanges, original, modified, 3, 7, FILE, true);
      expect(patch).toContain("@@ -2,0 +3 @@\n+import {C} from './c';\n");
      expect(patch).toContain('@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n');
      expect(patch).toContain('@@ -7 +7 @@\n-  private y = 2;\n+  private y = 99;\n');
    });
  });
});

// ─── "Unstage this line" / "Unstage lines"  (stage=false, original editor) ───

describe('"Unstage this line" / "Unstage lines"  (stage=false)', () => {

  describe('pure insertion unstage — remove import {C} from index', () => {
    // Selection must be in modified editor coords (inOriginalEditor=false)
    it('Unstage this line — emits forward patch; git apply -R --cached removes it', () => {
      expect(buildZeroContextPatch([c_insert], original, modified, 3, 3, FILE, false, false))
        .toBe(header(FILE) + '@@ -2,0 +3 @@\n+import {C} from \'./c\';\n');
    });

    it('Unstage this line — returns null when selection misses the inserted line', () => {
      expect(buildZeroContextPatch([c_insert], original, modified, 1, 2, FILE, false, false))
        .toBeNull();
    });
  });

  describe('pure deletion unstage — restore blank line at orig 8', () => {
    it('Unstage this line — full deletion block (inOriginalEditor=true)', () => {
      expect(buildZeroContextPatch([c_delete], original, modified, 8, 8, FILE, false, true))
        .toBe(header(FILE) + '@@ -8 +7,0 @@\n-\n');
    });

    it('Unstage this line — returns null when selection misses orig line 8 (inOriginalEditor=true)', () => {
      expect(buildZeroContextPatch([c_delete], original, modified, 5, 7, FILE, false, true))
        .toBeNull();
    });

    it('Unstage this line — full deletion block (inOriginalEditor=false, selection touches modStart)', () => {
      // In modified-editor view the deletion marker sits at modStart=8
      expect(buildZeroContextPatch([c_delete], original, modified, 8, 8, FILE, false, false))
        .toBe(header(FILE) + '@@ -8 +7,0 @@\n-\n');
    });

    it('Unstage this line — returns null when inOriginalEditor=false and selection misses modStart', () => {
      expect(buildZeroContextPatch([c_delete], original, modified, 5, 7, FILE, false, false))
        .toBeNull();
    });
  });

  describe('equal-count replacement unstage — revert x and y', () => {
    it('Unstage this line — unstages only x (single pair)', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 6, FILE, false))
        .toBe(header(FILE) + '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n');
    });

    it('Unstage lines — unstages both x and y as separate mini-hunks', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 7, FILE, false))
        .toBe(header(FILE) +
          '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n' +
          '@@ -7 +7 @@\n-  private y = 2;\n+  private y = 99;\n');
    });
  });

  describe('unequal-count replacement unstage — revert const a/b → a/b/c', () => {
    it('Unstage lines — emits full hunk; git apply -R --cached reverses it', () => {
      expect(buildZeroContextPatch([c_unequal], original, modified, 14, 15, FILE, false))
        .toBe(header(FILE) + '@@ -14,2 +13,3 @@\n-    const a = 1;\n-    const b = 2;\n+    const a = 10;\n+    const b = 20;\n+    const c = 30;\n');
    });
  });
});

// ─── "Discard this line" / "Discard lines"  (stage=false, working dir) ───────
//
// discardLine calls buildPatch(ed, false) then workingDir.discardChangesWithPatch(patch).
// The patch is identical to unstage — git apply -R (no --cached) writes to working dir.
// NOTE: the current code has a bug — discardLine calls buildPatch(ed, true) instead of false.

describe('"Discard this line" / "Discard lines"  (stage=false, apply -R to working dir)', () => {

  describe('pure insertion discard — remove inserted import from working dir', () => {
    it('Discard this line — same patch shape as unstage insertion', () => {
      expect(buildZeroContextPatch([c_insert], original, modified, 3, 3, FILE, false, false))
        .toBe(header(FILE) + '@@ -2,0 +3 @@\n+import {C} from \'./c\';\n');
    });
  });

  describe('pure deletion discard — restore deleted blank line in working dir', () => {
    it('Discard this line — restores blank line (inOriginalEditor=true)', () => {
      expect(buildZeroContextPatch([c_delete], original, modified, 8, 8, FILE, false, true))
        .toBe(header(FILE) + '@@ -8 +7,0 @@\n-\n');
    });
  });

  describe('equal-count replacement discard — revert x=42 back to x=1', () => {
    it('Discard this line — single line', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 6, FILE, false))
        .toBe(header(FILE) + '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n');
    });

    it('Discard lines — both x and y', () => {
      expect(buildZeroContextPatch([c_equal], original, modified, 6, 7, FILE, false))
        .toBe(header(FILE) +
          '@@ -6 +6 @@\n-  private x = 1;\n+  private x = 42;\n' +
          '@@ -7 +7 @@\n-  private y = 2;\n+  private y = 99;\n');
    });
  });

  describe('unequal-count replacement discard — revert const a/b/c back to a/b', () => {
    it('Discard lines — full hunk; git apply -R writes original content back', () => {
      expect(buildZeroContextPatch([c_unequal], original, modified, 14, 15, FILE, false))
        .toBe(header(FILE) + '@@ -14,2 +13,3 @@\n-    const a = 1;\n-    const b = 2;\n+    const a = 10;\n+    const b = 20;\n+    const c = 30;\n');
    });
  });
});

// ─── edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('returns null for empty changes array', () => {
    expect(buildZeroContextPatch([], original, modified, 1, 1, FILE, true)).toBeNull();
  });

  it('returns null when no change overlaps the selection', () => {
    expect(buildZeroContextPatch(allChanges, original, modified, 1, 2, FILE, true)).toBeNull();
  });

  it('includes correct file path in patch header', () => {
    const patch = buildZeroContextPatch([c_insert], original, modified, 3, 3, 'deep/path/file.ts', true);
    expect(patch).toContain('--- a/deep/path/file.ts\n+++ b/deep/path/file.ts\n');
  });

  it('converts ␍ (U+240D) display substitute back to \\r in patch bytes', () => {
    const origCr = model(['line␍end']);
    const modCr  = model(['line␍end2']);
    const c = change(1, 1, 1, 1);
    expect(buildZeroContextPatch([c], origCr, modCr, 1, 1, FILE, true))
      .toContain('-line\rend\n+line\rend2\n');
  });

  it('clamps origStart-1 to 0 when pure insertion is at the very top of file', () => {
    const c0 = change(1, 0, 1, 1);
    const top = buildZeroContextPatch([c0], model([]), model(['first']), 1, 1, FILE, true);
    expect(top).toContain('@@ -0,0 +1 @@\n+first\n');
  });
});