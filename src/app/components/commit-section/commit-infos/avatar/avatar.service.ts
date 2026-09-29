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

import {inject, Injectable} from '@angular/core';
import {forkJoin, from, map, Observable, of, switchMap} from 'rxjs';
import {notUndefined} from '../../../../utils/utils';
import {LocalStorageService} from '../../../../services/local-storage.service';
import {StorageName} from '../../../../enums/storage-name.enum';

// How long an avatar URL that answered 404 is not requested again (across restarts)
const MISSING_AVATAR_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable({providedIn: 'root'})
export class AvatarService {

  private localStorage = inject(LocalStorageService);

  // url → objectURL (null: no avatar). Promises, so concurrent requests for the same url share one fetch
  private blobUrlCache = new Map<string, Promise<string | null>>();
  // url → time of the 404, persisted
  private missingAvatars: Record<string, number> = this.readMissingAvatars();

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
    const ghUrl = this.githubUrl(email);
    if (ghUrl) return from(this.get(ghUrl));
    return from(this.gravatarUrl(email)).pipe(switchMap(url => from(this.get(url))));
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

  private get = (url: string) => {
    if (this.missingAvatars[url]) return Promise.resolve(null);
    let objectUrl = this.blobUrlCache.get(url);
    if (!objectUrl) {
      objectUrl = this.fetchBlobUrl(url);
      this.blobUrlCache.set(url, objectUrl);
    }
    return objectUrl;
  };

  private fetchBlobUrl = async (url: string) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        this.rememberMissing(url);
        return null;
      }
      return URL.createObjectURL(await resp.blob());
    } catch {
      this.blobUrlCache.delete(url); // network error: retry next time
      return null;
    }
  };

  private rememberMissing = (url: string) => {
    this.missingAvatars[url] = Date.now();
    this.localStorage.store(StorageName.MissingAvatars, this.missingAvatars);
  };

  private readMissingAvatars() {
    const now = Date.now();
    return Object.fromEntries(Object.entries(this.localStorage.get<Record<string, number>>(StorageName.MissingAvatars) ?? {})
      .filter(([, missingSince]) => now - missingSince < MISSING_AVATAR_TTL_MS));
  }

  private githubUrl(email: string) {
    const match = email.match(/^(?:(\d+)\+[^@]+|([^@]+))@users\.noreply\.github\.com$/i);
    if (!match) return null;
    const [, id, username] = match;
    return id ? `https://avatars.githubusercontent.com/u/${id}?v=4` : `https://avatars.githubusercontent.com/${username}`;
  }

  private async gravatarUrl(email: string): Promise<string> {
    const hash = await window.tauri.crypto.md5(email.trim().toLowerCase());
    return `https://www.gravatar.com/avatar/${hash}?d=404`;
  }
}
