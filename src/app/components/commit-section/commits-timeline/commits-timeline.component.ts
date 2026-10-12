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

import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
import {DatePipe} from '@angular/common';
import {Tooltip} from 'primeng/tooltip';
import {type Commit} from '../../../lib/github-desktop/model/commit';
import {DATE_FORMAT, MINUTE_MS} from '../../../utils/constants';

const duration = (ms: number) => {
  const minutes = Math.round(ms / MINUTE_MS);
  if (minutes < 1) return '';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / (24 * 60))} days`;
};

@Component({
  selector: 'gitgud-commits-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    Tooltip,
    DatePipe,
  ],
  templateUrl: './commits-timeline.component.html',
  styleUrl: './commits-timeline.component.scss',
  standalone: true,
})
export class CommitsTimelineComponent {
  commits = input.required<Commit[]>();

  // Time span covered by the commits, each one placed on it (in %)
  protected timeline = computed(() => {
    const times = this.commits().map(c => c.author.date.getTime());
    const from = Math.min(...times);
    const span = Math.max(...times) - from;
    return {
      from: new Date(from),
      to: new Date(from + span),
      sameDay: new Date(from).toDateString() === new Date(from + span).toDateString(),
      duration: duration(span),
      ticks: this.commits().map((commit, i) => ({commit, position: span ? (times[i] - from) / span * 100 : 50})),
    };
  });

  protected DATE_FORMAT = DATE_FORMAT;
}
