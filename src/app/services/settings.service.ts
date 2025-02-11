import { Injectable } from '@angular/core';
import { StorageName } from "../enums/storage-name.enum";

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    static readonly DEFAULT_NUMBER_OR_COMMITS_TO_SHOW = 2000; // TODO: make settings window

    store = (where: StorageName, item: any) => localStorage.setItem(where, JSON.stringify(item));

    get = <T>(where: StorageName): T | undefined => JSON.parse(localStorage.getItem(where)!);

}
