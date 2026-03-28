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