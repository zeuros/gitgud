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

import {short} from './commit-utils';

// Rework git rebase actions to edit a specified commit summary and description (newMessage)
export const rewordCommitAction = (cwd: string, selectedCommitSha: string, newMessage: string) => {
    const msgFile = '.git/COMMIT_EDIT_MSG';

    // Write message file
    window.electron.fs.writeFileSync(`${cwd}/${msgFile}`, newMessage);

    return (actions: string[]) =>
      actions.flatMap(action =>
        action.includes(short(selectedCommitSha))
          ? [action, `exec git commit --amend -F ${msgFile} && rm ${msgFile}`]
          : [action],
      );
  };