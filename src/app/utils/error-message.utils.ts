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

/** What to tell the user about an error, if anything */
export const errorMessage = (error: unknown): string | undefined => {
  if (error instanceof Error) return error.message;
  // Tauri IPC errors arrive as "exited N\n<stderr>" — strip the status prefix
  if (typeof error === 'string') return error.replace(/^exited \d+\n/, '').trim();
  // A Rust command's error struct (WatchError…), deserialized by the IPC bridge into a plain object
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return undefined;
};
