import { RustCommand } from "../services/node-api.service";

export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const checkFolderIsGitRepository = (repositoryPath: null | string | string[]) => !!repositoryPath && typeof repositoryPath == 'string' // TODO: finish this

export const prepareCommand = (repoDirectory: string) => (command: string): RustCommand => {
    let split = command.split(' ');

    return {
        program: split.shift() ?? '',
        args: split ?? [''],
        directory: repoDirectory
    };
};