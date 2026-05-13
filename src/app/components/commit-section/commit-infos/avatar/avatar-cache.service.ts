/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import {Injectable} from '@angular/core';
import {from, Observable} from 'rxjs';

@Injectable({providedIn: 'root'})
export class AvatarCacheService {

  private cache = new Map<string, string | null>(); // url → objectURL

  // Tries GitHub avatar first (if noreply email), then Gravatar. Returns null if both fail.
  resolve(email: string) {
    const avatarUrl = this.githubUrl(email) ?? this.gravatarUrl(email);
    return from(this.get(avatarUrl));
  }

  private async get(url: string) {
    if (this.cache.has(url)) return this.cache.get(url)!;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        this.cache.set(url, null);
        return null;
      }
      const objectUrl = URL.createObjectURL(await resp.blob());
      this.cache.set(url, objectUrl);
      return objectUrl;
    } catch {
      return null;
    }
  }

  private githubUrl(email: string) {
    const match = email.match(/^(?:(\d+)\+[^@]+|([^@]+))@users\.noreply\.github\.com$/i);
    if (!match) return null;
    const [, id, username] = match;
    return id ? `https://avatars.githubusercontent.com/u/${id}?v=4` : `https://avatars.githubusercontent.com/${username}`;
  }

  private gravatarUrl(email: string) {
    const hash = window.electron.crypto.md5(email.trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
  }
}
