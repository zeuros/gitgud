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

import {AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild} from '@angular/core';

@Component({
  selector: 'gitgud-search-logs',
  standalone: true,
  imports: [],
  templateUrl: './search-logs.component.html',
  styleUrl: './search-logs.component.scss'
})
export class SearchLogsComponent implements AfterViewInit, OnChanges {

  @Output() onSearch = new EventEmitter<string>();

  @ViewChild("search", {static: false}) private search?: ElementRef<HTMLCanvasElement>;
  @Input() focus!: {};

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.focus) this.focusSearchInput();
  }

  ngAfterViewInit(): void {
    this.focusSearchInput()
  }

  private focusSearchInput = () => {
    this.search?.nativeElement?.focus();
  }
  console = console;
}
