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

import {GitApiService} from '../../services/electron-cmd-parser-layer/git-api.service';


/**
 * Retrieve the binary contents of a blob from the repository at a given
 * reference, commit, or tree.
 *
 * Returns a promise that will produce a Buffer instance containing
 * the binary contents of the blob or an error if the file doesn't
 * exists in the given revision.
 *
 * @param gitApi
 * @param commitish  - A commit SHA or some other identifier that
 *                     ultimately dereferences to a commit/tree.
 *
 * @param path       - The file path, relative to the repository
 *                     root from where to read the blob contents
 */
export const getBlobContents = (gitApi: GitApiService, commitish: string, path: string) =>
  gitApi.git(['show', `${commitish}:${path}`]);

/**
 * Retrieve some or all binary contents of a blob from the repository
 * at a given reference, commit, or tree. This is almost identical
 * to the getBlobContents method except that it supports only reading
 * a maximum number of bytes.
 *
 * Returns a promise that will produce a Buffer instance containing
 * the binary contents of the blob or an error if the file doesn't
 * exists in the given revision.
 *
 * @param repository - The repository from where to read the blob
 *
 * @param commitish  - A commit SHA or some other identifier that
 *                     ultimately dereferences to a commit/tree.
 *
 * @param path       - The file path, relative to the repository
 *                     root from where to read the blob contents
 *
 * @param length     - The maximum number of bytes to read from
 *                     the blob. Note that the number of bytes
 *                     returned may always be less than this number.
 */
export const getPartialBlobContents = getBlobContents;
export const getPartialBlobContentsCatchPathNotInRef = getBlobContents;
