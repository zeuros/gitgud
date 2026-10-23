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

import {inject, type Signal, signal} from '@angular/core';
import {type DisplayRef} from '../../lib/github-desktop/model/display-ref';
import {CurrentRepoStore} from '../../stores/current-repo.store';

/**
 * Search in the log: dims the commits that don't match, then steps through the matching ones.
 */
export class LogSearch {

  private currentRepo = inject(CurrentRepoStore);

  matches = signal<number[]>([]); // Indexes of displayed log's matched commits
  currentMatch = signal(-1);

  constructor(private displayLog: Signal<DisplayRef[]>, private scrollToRow: (index: number) => void) {}

  search = (searchString = '') => {
    const displayLog = this.displayLog();

    displayLog.forEach(commit => commit.highlight = undefined);
    this.matches.set([]);
    this.currentMatch.set(-1);

    if (searchString == '') // Clear search
      return;

    const searchStringL = searchString.toLowerCase();
    displayLog
      .filter(({sha, summary, author, committer, branchesDetails}) => !(
        sha.includes(searchStringL)
        || summary.toLowerCase().includes(searchStringL)
        || author?.name?.toLowerCase().includes(searchStringL)
        || committer?.name?.toLowerCase().includes(searchStringL)
        || branchesDetails?.some(branch => branch.name.toLowerCase().includes(searchStringL))
      ))
      .forEach(commit => commit.highlight = 'not-matched');

    const matches = displayLog.flatMap((c, i) => c.highlight ? [] : [i]);
    this.matches.set(matches);
    if (matches.length) {
      this.currentMatch.set(0);
      this.scrollToRow(matches[0]);
    }
  };

  // Selects the next (step = 1) or previous (step = -1) match, wrapping around. The first call selects the match scrolled to while typing
  goToMatch = (step: 1 | -1) => {
    const matches = this.matches();
    if (!matches.length) return;
    const shown = this.displayLog()[matches[this.currentMatch()]]?.sha;
    const isShownSelected = this.currentRepo.selectedCommitsShas()?.includes(shown);
    const current = isShownSelected ? (this.currentMatch() + step + matches.length) % matches.length : this.currentMatch();
    this.currentMatch.set(current);
    this.currentRepo.update({selectedCommitsShas: [this.displayLog()[matches[current]].sha]});
  };
}
