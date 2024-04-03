import { Injectable } from '@angular/core';
import { StorePlace } from "../enums/store-place.enum";

@Injectable({
  providedIn: 'root'
})
export class SettingsService {

  constructor() { }

  store(where: StorePlace, item: any) {
    localStorage.setItem(item, JSON.stringify(item));
  }

  get<T>(where: StorePlace): T {
    return JSON.parse(localStorage.getItem(where)!);
  }

}
