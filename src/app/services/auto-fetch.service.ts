import {inject, Injectable} from '@angular/core';
import {GitRepositoryService} from './git-repository.service';
import {SettingsService} from './settings.service';
import {StorageName} from '../enums/storage-name.enum';
import {DEFAULT_AUTO_FETCH_INTERVAL} from '../utils/constants';

@Injectable({
  providedIn: 'root',
})
export class AutoFetchService {

  private readonly gitRepositoryService = inject(GitRepositoryService);
  private readonly settingsService = inject(SettingsService);

  readonly startAutoFetch = () => setTimeout(this.autoFetch, this.autoFetchInterval());

  // TODO: auto fetch only if no other programs have done it (stat .git/FETCH_HEAD to know that)
  private readonly autoFetch = () => {
    this.gitRepositoryService.fetchCurrentRepository();
    setTimeout(this.autoFetch, this.autoFetchInterval());
  };

  // TODO: make settings observable
  private readonly autoFetchInterval = () =>
    Number(this.settingsService.get<string>(StorageName.AutoFetchInterval) ?? DEFAULT_AUTO_FETCH_INTERVAL);
}
