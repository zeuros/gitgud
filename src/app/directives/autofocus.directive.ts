import {Directive, ElementRef, inject, type OnInit} from '@angular/core';

// Takes over the native autofocus attribute, which only works on page load
// eslint-disable-next-line @angular-eslint/directive-selector
@Directive({selector: '[autofocus]', standalone: true})
export class AutofocusDirective implements OnInit {
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit() {
    this.el.nativeElement.focus();
  }
}
