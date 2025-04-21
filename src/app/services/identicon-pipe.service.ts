// identicon.pipe.ts
import {Pipe, PipeTransform} from '@angular/core';
import Identicon from 'identicon.js';
import * as crypto from 'crypto';

@Pipe({
  name: 'identicon',
  standalone: true
})
export class IdenticonPipe implements PipeTransform {

  private crypto: typeof crypto = (window as any).require('crypto');

  transform(email: string) {
    const icon = new Identicon(this.crypto.createHash('md5').update(email).digest('hex'), {
      size: 48,
      format: 'png',
      background: [0, 0, 0, 0],
    });
    return `data:image/png;base64,${icon.toString()}`;
  }
}