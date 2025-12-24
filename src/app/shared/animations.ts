import {animate, style, transition, trigger} from '@angular/animations';

export const fadeSlideInOut =
  trigger('fadeSlideInOut', [
    transition(':enter', [
      style({opacity: 0, transform: 'translateY(10px)'}),
      animate('500ms', style({opacity: 1, transform: 'translateY(0)'})),
    ]),
    transition(':leave', [
      animate('500ms', style({opacity: 0, transform: 'translateY(10px)'})),
    ]),
  ]);


export const fadeSlideIn =
  trigger('fadeSlideIn', [
    transition(':enter', [
      style({opacity: 0, transform: 'translateY(6px)'}),
      animate('150ms', style({opacity: 1, transform: 'translateY(0)'})),
    ]),
  ]);

export const slightSlideIn =
  trigger('slightSlideIn', [
    transition(':enter', [
      style({opacity: 0, transform: 'translateY(-3px)'}),
      animate('100ms', style({opacity: 1, transform: 'translateY(0)'})),
    ]),
  ]);