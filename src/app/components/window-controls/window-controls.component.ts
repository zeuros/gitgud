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

import {ChangeDetectionStrategy, Component} from '@angular/core';

/** Close button of the undecorated window: dragging the title bar to the screen's edges or a double-click maximizes it. macOS keeps its native traffic lights */
@Component({
  selector: 'gitgud-window-controls',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  template: `
    @if (!isMacOs) {
      <button class="window-control" aria-label="Close" (click)="appWindow.close()">
        <svg viewBox="0 0 10 10"><path d="M0 0l10 10M10 0l-10 10"/></svg>
      </button>
    }
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding: 0 8px;
    }

    // Round buttons, like a browser's tab strip
    .window-control {
      width: 26px;
      height: 26px;
      padding: 0;
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--p-text-color) 8%, transparent);
      color: var(--p-text-color);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: default;

      svg {
        width: 8px;
        height: 8px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.2;
      }

      &:hover {
        background: color-mix(in srgb, var(--p-text-color) 18%, transparent);
      }

      &:active {
        background: color-mix(in srgb, var(--p-text-color) 28%, transparent);
      }
    }
  `,
})
export class WindowControlsComponent {

  protected readonly appWindow = window.tauri.appWindow;
  protected readonly isMacOs = window.tauri.process.platform === 'darwin';
}
