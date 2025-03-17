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
