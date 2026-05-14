import {Directive, ElementRef, inject, type OnInit} from '@angular/core';

@Directive({selector: '[autofocus]', standalone: true})
export class AutofocusDirective implements OnInit {
  private el = inject(ElementRef<HTMLElement>);

  ngOnInit() {
    this.el.nativeElement.focus();
  }
}
