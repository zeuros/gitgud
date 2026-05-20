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

import {inject, Injectable, signal} from '@angular/core';
import {HttpClient} from '@angular/common/http';
import {catchError, EMPTY, timer} from 'rxjs';

interface GithubRelease {
  tag_name: string;
  html_url: string;
}

type Release = { version: string; url: string };

const VERSION_CHECKED_KEY = 'update-last-checked';
const RELEASE_KEY = 'update-available-release';
const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable({providedIn: 'root'})
export class UpdateCheckService {

  private http = inject(HttpClient);
  private currentVersion = window.electron.appVersion;

  availableRelease = signal<Release | null>(null);

  constructor() {
    const stored = localStorage.getItem(RELEASE_KEY);
    if (stored) {
      const release = JSON.parse(stored) as Release;
      if (this.isNewer(release.version, this.currentVersion))
        this.availableRelease.set(release);
      else
        localStorage.removeItem(RELEASE_KEY);
    }

    // Check immediately, then every hour — the guard inside skips if < 1 day since last real version fetch check
    timer(0, ONE_HOUR_MS).subscribe(this.checkForDailyUpdate);
  }

  downloadUpdate = () => window.electron.openExternal(this.appDownloadUrl(this.availableRelease()!.version));

  private checkForDailyUpdate = () => {
    const lastChecked = Number(localStorage.getItem(VERSION_CHECKED_KEY) ?? 0);
    if (lastChecked !== 0 && Date.now() - lastChecked < ONE_DAY_MS) return;

    localStorage.setItem(VERSION_CHECKED_KEY, String(Date.now()));
    this.http.get<GithubRelease>('https://api.github.com/repos/zeuros/gitgud/releases/latest')
      .pipe(catchError(() => EMPTY)) // It's ok to not have internet :)
      .subscribe(({tag_name, html_url}) => {
        const latest = tag_name.replace(/^v/, '');
        if (this.isNewer(latest, this.currentVersion)) {
          const release = {version: latest, url: html_url};
          this.availableRelease.set(release);
          localStorage.setItem(RELEASE_KEY, JSON.stringify(release));
        }
      });
  };

  private appDownloadUrl = (version: string) => `https://github.com/zeuros/gitgud/releases/download/v${version}/${this.getAssetName(version)}`;

  private getAssetName = (version: string) => {
    const {platform, arch, execPath} = window.electron.process;

    if (platform === 'win32') return `GitGud-${version}-Windows-Setup.exe`;
    if (platform === 'darwin') return `GitGud-${version}-Mac-${arch}.dmg`;

    // Linux: use build-time injected format, fall back to execPath heuristic
    const linuxPackageFormat = window.electron.packageFormat ?? (execPath.includes('/rpm/') || execPath.endsWith('.rpm') ? 'rpm' : 'deb');
    return `GitGud-${version}-Linux-${arch}.${linuxPackageFormat}`;
  };

  private isNewer = (latest: string, current: string) => {
    const [lM, lm, lp] = latest.split('.').map(Number);
    const [cM, cm, cp] = current.split('.').map(Number);
    if (lM !== cM) return lM > cM;
    if (lm !== cm) return lm > cm;
    return lp > cp;
  };
}
