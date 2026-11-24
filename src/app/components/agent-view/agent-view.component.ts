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

import {ChangeDetectionStrategy, Component, computed, effect, type ElementRef, inject, linkedSignal, signal, viewChild} from '@angular/core';
import {toObservable, toSignal} from '@angular/core/rxjs-interop';
import {concatMap, defer, distinctUntilChanged, EMPTY, from, of, switchMap, timer} from 'rxjs';
import {Dialog} from 'primeng/dialog';
import {LlmSessionsService} from '../../services/llm-sessions.service';
import {appendTranscriptChunk, EMPTY_TRANSCRIPT, type Transcript} from '../../utils/claude-transcript-utils';
import {llmSessionLabel} from '../../utils/llm-session-utils';

const POLL_MS = 1000;
const COLLAPSED_RESULT_LINES = 3;
// Entries drawn, the last ones: "Show earlier" draws as many more
const SHOWN_ENTRIES_STEP = 300;
// Closer to the bottom than this, the view follows the transcript as it grows
const STICK_TO_BOTTOM_PX = 40;

/** The session opened from the Agents section: its transcript, live */
@Component({
  selector: 'gitgud-agent-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Dialog],
  templateUrl: './agent-view.component.html',
  styleUrl: './agent-view.component.scss',
})
export class AgentViewComponent {

  protected llmSessions = inject(LlmSessionsService);

  protected session = this.llmSessions.openedSession;
  protected transcript = toSignal(toObservable(this.session).pipe(
    switchMap(session => {
      const path = session && this.llmSessions.transcriptPath(session);
      return path ? this.watchTranscript(path) : of(undefined);
    }),
  ));
  protected shownEntryCount = linkedSignal(() => {
    this.session();
    return SHOWN_ENTRIES_STEP;
  });
  protected hiddenEntryCount = computed(() => Math.max(0, (this.transcript()?.entries.length ?? 0) - this.shownEntryCount()));
  protected shownEntries = computed(() => this.transcript()?.entries.slice(this.hiddenEntryCount()) ?? []);
  protected header = computed(() => {
    const session = this.session();
    return this.transcript()?.title ?? (session ? llmSessionLabel(session) : '');
  });
  protected expandedToolIds = signal(new Set<string>());
  private isAtBottom = true;

  private scroller = viewChild<ElementRef<HTMLElement>>('scroller');

  constructor() {
    effect(() => {
      this.transcript();
      const scroller = this.scroller()?.nativeElement;
      if (scroller && this.isAtBottom) requestAnimationFrame(() => scroller.scrollTop = scroller.scrollHeight);
    });
  }

  protected close = (visible: boolean) => {
    if (visible) return;
    this.session.set(undefined);
    this.isAtBottom = true;
  };

  protected onScroll = ({scrollTop, scrollHeight, clientHeight}: HTMLElement) =>
    this.isAtBottom = scrollHeight - scrollTop - clientHeight < STICK_TO_BOTTOM_PX;

  protected toggleResult = (toolId: string) => this.expandedToolIds.update(ids => {
    const expanded = new Set(ids);
    if (!expanded.delete(toolId)) expanded.add(toolId);
    return expanded;
  });

  protected shownResult = (toolId: string, result: string) => {
    const lines = result.trimEnd().split('\n');
    if (this.expandedToolIds().has(toolId) || lines.length <= COLLAPSED_RESULT_LINES) return lines.join('\n');
    return `${lines.slice(0, COLLAPSED_RESULT_LINES).join('\n')}\n… +${lines.length - COLLAPSED_RESULT_LINES} lines`;
  };

  protected showEarlierEntries = () => {
    this.isAtBottom = false;
    this.shownEntryCount.update(count => count + SHOWN_ENTRIES_STEP);
  };

  // Once its modification time changes, reads the lines added since: Rust parses them, sending only what's shown
  private watchTranscript = (path: string) => defer(() => {
    let transcript: Transcript = EMPTY_TRANSCRIPT;
    return timer(0, POLL_MS).pipe(
      switchMap(() => from(window.tauri.fs.mtime(path).catch(() => 0))),
      distinctUntilChanged(),
      concatMap(() => from(window.tauri.readTranscript(path, transcript.nextByte).catch(() => undefined))),
      concatMap(chunk => chunk ? of(transcript = appendTranscriptChunk(transcript, chunk)) : EMPTY),
    );
  });
}
