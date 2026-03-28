import {Pipe, PipeTransform} from '@angular/core';

@Pipe({
  name: 'gravatarUrl',
})
export class GravatarUrlPipe implements PipeTransform {

  transform(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const hash = window.electron.crypto.md5(normalizedEmail);
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
  }
}
