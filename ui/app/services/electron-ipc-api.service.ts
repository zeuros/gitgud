import {Injectable} from '@angular/core';
import {ElectronIpcApi} from "../models/electron-ipc-api";
import {forkJoin, from, map, Observable, switchMap, tap} from "rxjs";
import {PopupService} from "./popup.service";
import {SettingsService} from "./settings.service";
import {Commit} from "../../../src/models/commit";

export const notUndefined = <T>(a: T | void) => a as T;
export type BranchesAndLogs = { [branch: string]: Commit[] };

@Injectable({
  providedIn: 'root'
})
export class ElectronIpcApiService {

  constructor(
    private popupService: PopupService,
  ) {
  }

  // Git tools is an ipc api
  private electronIpcApi = (window as any).electronIpcApi as ElectronIpcApi;

  clone = (repositoryUrl: string, directory: string) => from(this.electronIpcApi.clone(repositoryUrl, directory).catch(this.popupService.error));

  openFolderPicker = () => from(this.electronIpcApi.pickGitFolder().catch(this.popupService.error)).pipe(map(notUndefined));

  log = (dir: string, ref = 'HEAD') => from(this.electronIpcApi.log({
    dir,
    depth: SettingsService.DEFAULT_NUMBER_OR_COMMITS_TO_SHOW,
    ref
  }).catch(this.popupService.error)).pipe(map(notUndefined));

  // BORING, this is a mess
  // Log all local branches commits
  logAll = (dir: string): Observable<BranchesAndLogs> =>
    this.listLocalBranches(dir)
      .pipe(
        tap(r => console.log(r)),
        switchMap(branches => forkJoin(branches.map(branch => this.log(dir, branch).pipe(map(log => ({branch, log})))))),
        map((logs) => logs.reduce((acc, {branch, log}) => ({...acc, [branch]: log}), {} as BranchesAndLogs)),
      );

  listRemotes = (dir: string) => from(this.electronIpcApi.listRemotes({dir}).catch(this.popupService.error)).pipe(map(notUndefined));

  listLocalBranches = (dir: string) => from(this.electronIpcApi.listBranches({dir}).catch(this.popupService.error)).pipe(map(notUndefined));

  listRemoteBranches = (dir: string, remote = 'origin') => from(this.electronIpcApi.listBranches({dir, remote}).catch(this.popupService.error)).pipe(map(notUndefined));

  findMergeBase = (dir: string, oids: string[]) => from(this.electronIpcApi.findMergeBase({dir, oids}).catch(this.popupService.error)).pipe(map(notUndefined));

  currentBranch = (dir: string) => from(this.electronIpcApi.currentBranch({dir}).catch(this.popupService.error)).pipe(map(notUndefined));

  sampleError = () => from(this.electronIpcApi.sampleError().catch(this.popupService.error));

  resolveRef = (dir: string, ref = 'HEAD') => from(this.electronIpcApi.resolveRef({dir, ref}).catch(this.popupService.error));

}
