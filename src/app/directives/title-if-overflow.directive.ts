import {Directive, ElementRef, HostListener, inject, input} from '@angular/core';

@Directive({selector: '[gitgudTitleIfOverflow]', standalone: true})
export class TitleIfOverflowDirective {
  gitgudTitleIfOverflow = input.required<string>();
  private el = inject(ElementRef<HTMLElement>);

  @HostListener('mouseenter')
  onMouseEnter() {
    const el = this.el.nativeElement;
    el.title = el.scrollWidth > el.clientWidth ? this.gitgudTitleIfOverflow() : '';
  }
}
