import {ipcMain} from "electron";
import {clone} from "./lib/git";

const bindIpcFunctions = () => {
  // ipcMain.handle('sample-error', async (event, args) => {
  //   throw new Error('wops !');
  // });
  // ipcMain.handle('pick-git-folder', async (event, args) => {
  //   const openDialogReturnValue = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  //   const gitDir = await git.findRoot({ fs, filepath: openDialogReturnValue.filePaths[0] });
  //
  //   if ( gitDir === '.' ) throw new Error("This folder is not a valid git repository");
  //
  //   return gitDir;
  //
  // });
  // ipcMain.handle('read-directory', async (event, dir) => await fs.readdir(dir));
  // ipcMain.handle('write-file', async (event, path, data) => await fs.writeFile(path, data));
  // ipcMain.handle('unlink', async (eventop, path) => await fs.unlink(path));


  ipcMain.handle('git-clone', async (event, url, dir) => await clone(url, dir, {}));
  // ipcMain.handle('git-errors', async (event, args) => await git.Errors);
  // ipcMain.handle('git-stage', async (event, args) => await git.STAGE());
  // ipcMain.handle('git-tree', async (event, args) => await git.TREE({ ...args, fs }));
  // ipcMain.handle('git-workdir', async (event, args) => await git.WORKDIR());
  // ipcMain.handle('git-add', async (event, dir, filepath) => await git.add({ fs, dir, filepath }));
  // ipcMain.handle('git-add-all', async (event, repo, filepath) => git.statusMatrix(repo).then((statuses) =>
  //   Promise.all(statuses.map(([filepath, , worktreeStatus]) => worktreeStatus ? git.add({ ...repo, filepath }) : git.remove({ ...repo, filepath })))
  // ));
  // ipcMain.handle('git-abort-merge', async (event, args) => await git.abortMerge({ ...args, fs }));
  // ipcMain.handle('git-add-note', async (event, args) => await git.addNote({ ...args, fs }));
  // ipcMain.handle('git-add-remote', async (event, args) => await git.addRemote({ ...args, fs }));
  // ipcMain.handle('git-annotated-tag', async (event, args) => await git.annotatedTag({ ...args, fs }));
  // ipcMain.handle('git-branch', async (event, args) => await git.branch({ ...args, fs }));
  // ipcMain.handle('git-checkout', async (event, args) => await git.checkout({ ...args, fs }));
  // ipcMain.handle('git-commit', async (event, dir, message, author) => await git.commit({ fs, dir, message, author }));
  // ipcMain.handle('git-get-config', async (event, args) => await git.getConfig({ ...args, fs }));
  // ipcMain.handle('git-get-config-all', async (event, args) => await git.getConfigAll({ ...args, fs }));
  // ipcMain.handle('git-set-config', async (event, args) => await git.setConfig({ ...args, fs }));
  // ipcMain.handle('git-current-branch', async (event, args) => await git.currentBranch({ ...args, fs }));
  // ipcMain.handle('git-delete-branch', async (event, args) => await git.deleteBranch({ ...args, fs }));
  // ipcMain.handle('git-delete-ref', async (event, args) => await git.deleteRef({ ...args, fs }));
  // ipcMain.handle('git-delete-remote', async (event, args) => await git.deleteRemote({ ...args, fs }));
  // ipcMain.handle('git-delete-tag', async (event, args) => await git.deleteTag({ ...args, fs }));
  // ipcMain.handle('git-expand-oid', async (event, args) => await git.expandOid({ ...args, fs }));
  // ipcMain.handle('git-expand-ref', async (event, args) => await git.expandRef({ ...args, fs }));
  // ipcMain.handle('git-fast-forward', async (event, args) => await git.fastForward({ ...args, fs }));
  // ipcMain.handle('git-fetch', async (event, args) => await git.fetch({ ...args, fs }));
  // ipcMain.handle('git-find-merge-base', async (event, args) => await git.findMergeBase({ ...args, fs }));
  // ipcMain.handle('git-find-root', async (event, args) => await git.findRoot({ ...args, fs }));
  // ipcMain.handle('git-get-remote-info', async (event, args) => await git.getRemoteInfo({ ...args, fs }));
  // ipcMain.handle('git-get-remote-info-2', async (event, args) => await git.getRemoteInfo2({ ...args, fs }));
  // ipcMain.handle('git-hash-blob', async (event, args) => await git.hashBlob({ ...args, fs }));
  // ipcMain.handle('git-index-pack', async (event, args) => await git.indexPack({ ...args, fs }));
  // ipcMain.handle('git-init', async (event, args) => await git.init({ ...args, fs }));
  // ipcMain.handle('git-is-descendent', async (event, args) => await git.isDescendent({ ...args, fs }));
  // ipcMain.handle('git-is-ignored', async (event, args) => await git.isIgnored({ ...args, fs }));
  // ipcMain.handle('git-list-branches', async (event, args) => await git.listBranches({ ...args, fs }));
  // ipcMain.handle('git-list-files', async (event, args) => await git.listFiles({ ...args, fs }));
  // ipcMain.handle('git-list-notes', async (event, args) => await git.listNotes({ ...args, fs }));
  // ipcMain.handle('git-list-remotes', async (event, args) => await git.listRemotes({ ...args, fs }));
  // ipcMain.handle('git-list-server-refs', async (event, args) => await git.listServerRefs({ ...args, fs }));
  // ipcMain.handle('git-list-tags', async (event, args) => await git.listTags({ ...args, fs }));
  // ipcMain.handle('git-log', async (event, args) => await git.log({ ...args, fs }));
  // ipcMain.handle('git-merge', async (event, args) => await git.merge({ ...args, fs }));
  // ipcMain.handle('git-pack-objects', async (event, args) => await git.packObjects({ ...args, fs }));
  // ipcMain.handle('git-pull', async (event, args) => await git.pull({ ...args, fs }));
  // ipcMain.handle('git-push', async (event, args) => await git.push({ ...args, fs }));
  // ipcMain.handle('git-read-blob', async (event, args) => await git.readBlob({ ...args, fs }));
  // ipcMain.handle('git-read-commit', async (event, args) => await git.readCommit({ ...args, fs }));
  // ipcMain.handle('git-read-note', async (event, args) => await git.readNote({ ...args, fs }));
  // ipcMain.handle('git-read-object', async (event, args) => await git.readObject({ ...args, fs }));
  // ipcMain.handle('git-read-tag', async (event, args) => await git.readTag({ ...args, fs }));
  // ipcMain.handle('git-read-tree', async (event, args) => await git.readTree({ ...args, fs }));
  // ipcMain.handle('git-remove', async (event, dir, filepath) => await git.remove({ fs, dir, filepath }));
  // ipcMain.handle('git-remove-note', async (event, args) => await git.removeNote({ ...args, fs }));
  // ipcMain.handle('git-rename-branch', async (event, args) => await git.renameBranch({ ...args, fs }));
  // ipcMain.handle('git-reset-index', async (event, args) => await git.resetIndex({ ...args, fs }));
  // ipcMain.handle('git-update-index', async (event, args) => await git.updateIndex({ ...args, fs }));
  // ipcMain.handle('git-resolve-ref', async (event, args) => await git.resolveRef({ ...args, fs }));
  // ipcMain.handle('git-status', async (event, dir, filepath) => await git.status({ fs, dir, filepath/*ex: readme.md*/ }));
  // ipcMain.handle('git-status-matrix', async (event, args) => await git.statusMatrix({ ...args, fs }));
  // ipcMain.handle('git-tag', async (event, args) => await git.tag({ ...args, fs }));
  // ipcMain.handle('git-version', async (event, args) => await git.version({ ...args, fs }));
  // ipcMain.handle('git-walk', async (event, args) => await git.walk({ ...args, fs }));
  // ipcMain.handle('git-write-blob', async (event, args) => await git.writeBlob({ ...args, fs }));
  // ipcMain.handle('git-write-commit', async (event, args) => await git.writeCommit({ ...args, fs }));
  // ipcMain.handle('git-write-object', async (event, args) => await git.writeObject({ ...args, fs }));
  // ipcMain.handle('git-write-ref', async (event, args) => await git.writeRef({ ...args, fs }));
  // ipcMain.handle('git-write-tag', async (event, args) => await git.writeTag({ ...args, fs }));
  // ipcMain.handle('git-write-tree', async (event, args) => await git.writeTree({ ...args, fs }));
};

module.exports = {
  bindIpcFunctions,
};