import {signal} from '@angular/core';

export const loadStashImage = () => {
  const imgSignal = signal<HTMLImageElement | undefined>(undefined);

  const img = new Image();
  img.src = '/assets/images/chest-bordered.svg';
  img.onload = () => imgSignal.set(img);

  return imgSignal.asReadonly();
};