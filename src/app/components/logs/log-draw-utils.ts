import {Observable} from 'rxjs';

export const loadStashImage = (): Observable<HTMLImageElement> => new Observable(subscriber => {
  const img = new Image();
  img.src = '/assets/images/chest.svg';
  img.onload = () => {
    subscriber.next(img);
    subscriber.complete();
  };
});