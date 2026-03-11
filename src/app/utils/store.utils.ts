import {Signal} from '@angular/core';
import {StorageName} from '../enums/storage-name.enum';
import {toObservable} from '@angular/core/rxjs-interop';
import {debounceTime} from 'rxjs';
import {LocalStorageService} from '../services/local-storage.service';

export const syncToStorage = <T>(signal: Signal<T>, key: StorageName, localStorageService: LocalStorageService) =>
  toObservable(signal)
    .pipe(debounceTime(500))
    .subscribe(value => localStorageService.store(key, value));