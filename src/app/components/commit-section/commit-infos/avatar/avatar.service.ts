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
import {forkJoin, from, map, Observable, of, switchMap} from 'rxjs';
import {notUndefined} from '../../../../utils/utils';

@Injectable({providedIn: 'root'})
export class AvatarService {

  private mailBlobsCache = new Map<string, string | null>(); // url → objectURL

  // Resolves all emails in parallel, emits the full image map once all settle.
  loadAvatarImages(emails: Set<string>): Observable<Map<string, HTMLImageElement>> {
    return forkJoin([...emails].map(this.convertEmailToBlob)).pipe(
      map(r => r
        .filter(notUndefined)
        .reduce((acc, {email, img}) => acc.set(email, img), new Map<string, HTMLImageElement>())),
    );
  }

  private convertEmailToBlob = (email: string) =>
    this.findAvatarImgAndConvertToBlobUrl(email).pipe(switchMap(objectUrl => objectUrl ? this.blobUrlToHtmlImg(email, objectUrl) : of(null)));

  // Tries GitHub avatar first (if noreply email), then Gravatar. Returns null if both fail.
  findAvatarImgAndConvertToBlobUrl = (email: string) => {
    const avatarUrl = this.githubUrl(email) ?? this.gravatarUrl(email);
    return from(this.get(avatarUrl));
  };

  private blobUrlToHtmlImg = (email: string, objectUrl: string) =>
    new Observable<{ email: string, img: HTMLImageElement } | null>(subscriber => {
      const img = new Image();
      img.onload = () => {
        subscriber.next({email, img});
        subscriber.complete();
      };
      img.onerror = () => {
        subscriber.next(null);
        subscriber.complete();
      };
      img.src = objectUrl;
    });

  private async get(url: string) {
    if (this.mailBlobsCache.has(url)) return this.mailBlobsCache.get(url)!;
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        this.mailBlobsCache.set(url, null);
        return null;
      }
      const objectUrl = URL.createObjectURL(await resp.blob());
      this.mailBlobsCache.set(url, objectUrl);
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
