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

import {inject, Injectable} from '@angular/core';
import {type CdkDragEnd} from '@angular/cdk/drag-drop';
import {Branch} from '../lib/github-desktop/model/branch';
import {type LocalAndDistantTagWithName} from '../utils/tag-utils';
import {BranchDragDropService} from './branch-drag-drop.service';
import {TagDragDropService} from './tag-drag-drop.service';

type ChipTarget = Branch | LocalAndDistantTagWithName;
const isBranch = (t: ChipTarget): t is Branch => 'tip' in t;

/** Facade that unifies branch and tag drag-drop for the log template. */
@Injectable({providedIn: 'root'})
export class LogDragDropService {
  private branchDragDrop = inject(BranchDragDropService);
  private tagDragDrop = inject(TagDragDropService);

  isValidDropTarget = (target: ChipTarget | null): boolean => {
    if (!target) return false;
    return isBranch(target)
      ? this.branchDragDrop.isValidDropTarget(target) || this.tagDragDrop.isValidDropTarget(target)
      : this.branchDragDrop.isValidTagDropTarget(target);
  };

  isHovered = (target: ChipTarget | null): boolean => {
    if (!target) return false;
    return isBranch(target)
      ? this.branchDragDrop.hoveredBranch() === target || this.tagDragDrop.hoveredBranch() === target
      : this.branchDragDrop.hoveredTag()?.name === target.name;
  };

  onChipMouseEnter = (target: ChipTarget | null) => {
    if (!target) return;
    if (isBranch(target)) {
      this.branchDragDrop.onMouseEnter(target);
      this.tagDragDrop.onMouseEnter(target);
    } else {
      this.branchDragDrop.onTagMouseEnter(target);
    }
  };

  onChipMouseLeave = () => {
    this.branchDragDrop.onMouseLeave();
    this.tagDragDrop.onMouseLeave();
    this.branchDragDrop.onTagMouseLeave();
  };

  onBranchDragStarted = (branch: Branch | null) => this.branchDragDrop.onDragStarted(branch);
  onBranchDragEnded = (event: CdkDragEnd<Branch>) => this.branchDragDrop.completeDrop(event);
  onTagDragStarted = (tag: LocalAndDistantTagWithName) => this.tagDragDrop.onDragStarted(tag);
  onTagDragEnded = (event: CdkDragEnd<LocalAndDistantTagWithName>) => this.tagDragDrop.completeDrop(event);
}
