import { Injectable } from '@angular/core';
import { StorageName } from "../enums/storage-name.enum";

@Injectable({
    providedIn: 'root'
})
export class SettingsService {

    store = (where: StorageName, item: any) => localStorage.setItem(where, JSON.stringify(item));

    get = <T>(where: StorageName): T | undefined => JSON.parse(localStorage.getItem(where)!);

}
