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

import {computed, inject, Injectable, signal} from '@angular/core';
import {CdkDragEnd} from '@angular/cdk/drag-drop';
import {MenuItem} from 'primeng/api';
import {Branch} from '../lib/github-desktop/model/branch';
import {ActiveContextMenuService} from './active-context-menu.service';
import {GitWorkflowService} from './git-workflow.service';

@Injectable({providedIn: 'root'})
export class BranchDragDropService {
  private activeContextMenu = inject(ActiveContextMenuService);
  private gitWorkflow = inject(GitWorkflowService);

  draggingBranch = signal<Branch | null>(null);
  hoveredBranch = signal<Branch | null>(null);
  source = signal<Branch | undefined>(undefined);
  target = signal<Branch | undefined>(undefined);

  private menu = computed<MenuItem[]>(() => {
    const source = this.source();
    const target = this.target();
    if (!source || !target) return [];
    // Available: source.name, target.name, this.gitWorkflow.doRunAndRefresh([...], msg)
    return [
      {label: `Merge ${source.name} into ${target.name}`, icon: 'fa fa-compress', command: this.mergeBranch},
    ];
  });

  onDragStarted = (branch: Branch | null) => this.draggingBranch.set(branch);

  completeDrop = (event: CdkDragEnd<Branch>) => {
    const source = this.draggingBranch();
    const target = this.hoveredBranch();

    // Snap back to origin
    event.source.reset();

    this.draggingBranch.set(null);
    this.hoveredBranch.set(null);

    if (!source || !target) return;

    this.source.set(source);
    this.target.set(target);

    this.activeContextMenu.show(this.menu(), event.event);
  };

  onMouseEnter = (branch: Branch | null) => {
    if(!branch) return;

    const dragging = this.draggingBranch();
    if (!dragging || branch.tip.sha === dragging.tip.sha) return;

    this.hoveredBranch.set(branch);
  };

  onMouseLeave = () => this.hoveredBranch.set(null);

}
