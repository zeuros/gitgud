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

/**
 * An action being computed in the background on behalf of the user
 */
export enum ComputedAction {
  /** The action is being computed in the background */
  Loading = 'loading',
  /** The action should complete without any additional work required by the user */
  Clean = 'clean',
  /** The action requires additional work by the user to complete successfully */
  Conflicts = 'conflicts',
  /** The action cannot be completed, for reasons the app should explain */
  Invalid = 'invalid',
}
