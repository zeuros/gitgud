export interface GitTools {
    clone: (repositoryUrl: string, directory: string) => Promise<void>
}