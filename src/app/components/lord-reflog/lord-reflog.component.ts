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

import {ChangeDetectionStrategy, Component, DOCUMENT, effect, inject, signal} from '@angular/core';

const KONAMI_CODE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

/** Easter egg: the Konami code summons Lord Reflog, who breaks the log until the player rests at the bonfire */
@Component({
  selector: 'gitgud-lord-reflog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  templateUrl: './lord-reflog.component.html',
  styleUrl: './lord-reflog.component.scss',
  host: {'(document:keydown)': 'onKeydown($event)'},
})
export class LordReflogComponent {
  protected summoned = signal(false);
  private recentKeys: string[] = [];

  constructor() {
    const document = inject(DOCUMENT);
    // The log rows sit in another component: they break through a class on <html>
    effect(() => document.documentElement.classList.toggle('reflog-wrath', this.summoned()));
  }

  protected onKeydown = (event: KeyboardEvent) => {
    // A key event dispatched on the document itself targets no element
    const target = event.target;
    if (this.summoned() || (target instanceof Element && (target.matches('input, textarea, [contenteditable]') || target.closest('.monaco-editor')))) return;
    this.recentKeys = [...this.recentKeys, event.key.length == 1 ? event.key.toLowerCase() : event.key].slice(-KONAMI_CODE.length);
    if (this.recentKeys.join() == KONAMI_CODE.join()) {
      this.recentKeys = [];
      this.summoned.set(true);
    }
  };

  protected restAtBonfire = () => this.summoned.set(false);
}
