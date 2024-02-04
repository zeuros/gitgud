export const lastFolderName = (f: string) => f.replace(/.*[\/\\]([^\\]+)[\/\\]/, '');

export const checkFolderIsGitRepository = (repositoryPath: null | string | string[]) => !!repositoryPath && typeof repositoryPath == 'string' // TODO: finish this