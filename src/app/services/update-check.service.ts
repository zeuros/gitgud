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

type GithubAsset = { name: string; browser_download_url: string };

interface GithubRelease {
  tag_name: string;
  html_url: string;
  assets: GithubAsset[];
}

type Release = { version: string; url: string; assets?: GithubAsset[] };

const VERSION_CHECKED_KEY = 'update-last-checked';
const RELEASE_KEY = 'update-available-release';
const ONE_DAY_MS = 86_400_000;
const ONE_HOUR_MS = 60 * 60 * 1000;

@Injectable({providedIn: 'root'})
export class UpdateCheckService {

  private http = inject(HttpClient);
  private currentVersion = window.tauri.appVersion;

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

  downloadUpdate = () => {
    // Resolved on click rather than cached, so a stored release never pins a stale asset choice
    const {url, assets} = this.availableRelease()!;
    const assetPattern = this.getAssetPattern();
    const downloadUrl = assetPattern && assets?.find(({name}) => assetPattern.test(name))?.browser_download_url;
    return window.tauri.openExternal(downloadUrl || url);
  };

  private checkForDailyUpdate = () => {
    const lastChecked = Number(localStorage.getItem(VERSION_CHECKED_KEY) ?? 0);
    if (lastChecked !== 0 && Date.now() - lastChecked < ONE_DAY_MS) return;

    localStorage.setItem(VERSION_CHECKED_KEY, String(Date.now()));
    this.http.get<GithubRelease>('https://api.github.com/repos/zeuros/gitgud/releases/latest')
      .pipe(catchError(() => EMPTY)) // It's ok to not have internet :)
      .subscribe(({tag_name, html_url, assets}) => {
        const latest = tag_name.replace(/^v/, '');
        if (this.isNewer(latest, this.currentVersion)) {
          const release = {
            version: latest,
            url: html_url,
            assets: assets?.map(({name, browser_download_url}) => ({name, browser_download_url})),
          };
          this.availableRelease.set(release);
          localStorage.setItem(RELEASE_KEY, JSON.stringify(release));
        }
      });
  };

  // Matches Tauri bundle names, e.g. GitGud_2.6.0_amd64.deb, GitGud-2.6.0-1.x86_64.rpm, GitGud_2.6.0_x64-setup.exe
  private getAssetPattern = () => {
    const {platform, arch} = window.tauri.process;
    const arm = arch === 'arm64';

    if (platform === 'win32') return new RegExp(`_${arm ? 'arm64' : 'x64'}-setup\\.exe$`);
    if (platform === 'darwin') return new RegExp(`_${arm ? 'aarch64' : 'x64'}\\.dmg$`);

    // Linux: format detected by the backend; unknown (dev build, tarball…) falls back to the release page
    const linuxPackageFormat = window.tauri.packageFormat;
    if (linuxPackageFormat === 'AppImage') return new RegExp(`_${arm ? 'aarch64' : 'amd64'}\\.AppImage$`);
    if (linuxPackageFormat === 'rpm') return new RegExp(`\\.${arm ? 'aarch64' : 'x86_64'}\\.rpm$`);
    if (linuxPackageFormat === 'deb') return new RegExp(`_${arm ? 'arm64' : 'amd64'}\\.deb$`);
    return undefined;
  };

  private isNewer = (latest: string, current: string) => {
    const [lM, lm, lp] = latest.split('.').map(Number);
    const [cM, cm, cp] = current.split('.').map(Number);
    if (lM !== cM) return lM > cM;
    if (lm !== cm) return lm > cm;
    return lp > cp;
  };
}
