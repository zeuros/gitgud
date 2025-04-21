import {Pipe, PipeTransform} from '@angular/core';
import * as crypto from 'crypto';

@Pipe({
  name: 'gravatarUrl'
})
export class GravatarUrlPipe implements PipeTransform {

  private crypto: typeof crypto = (window as any).require('crypto');

  transform(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const hash = this.crypto.createHash('md5').update(normalizedEmail).digest('hex');
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
  }
}
