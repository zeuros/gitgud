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

import type {StorageKey} from '../enums/storage-name.enum';

// JSON values in localStorage, under the app's keys
export class LocalStorage {

  static store = (where: StorageKey, item: unknown) => LocalStorage.storeRaw(where, JSON.stringify(item));

  static storeRaw = (where: StorageKey, json: string) => localStorage.setItem(where, json);

  // Undefined when nothing is stored, or what is stored isn't JSON
  static get = <T>(where: StorageKey): T | undefined => {
    try {
      return JSON.parse(localStorage.getItem(where)!) ?? undefined;
    } catch {
      return undefined;
    }
  };
}
