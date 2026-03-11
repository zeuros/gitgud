import {Pipe, PipeTransform} from '@angular/core';
import {identIcon} from '../utils/commit-utils';

@Pipe({
  name: 'identicon',
  standalone: true,
})
export class IdenticonPipe implements PipeTransform {
  readonly transform = (email: string) => `data:image/png;base64,${identIcon(email).toString()}`;
}