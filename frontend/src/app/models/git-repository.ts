export interface GitRepository {
    directory: string, // Identify the directory (like an id)
    name: string,
    sizes: number[] // panels sizes
    selected: boolean // currently selected
    localBranches: string[] // currently selected
}