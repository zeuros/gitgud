import {Component, Input} from '@angular/core';
import {GitRepository} from "../../models/git-repository";
import {TableModule} from "primeng/table";
import {NgIf} from "@angular/common";
import {CommitTree, CommitTreeCommit} from "../../utils/graph-utils";
import {CommitGraphLineComponent} from "./commit-graph-line/commit-graph-line.component";

function isMain(branch: string) {
  return ['master', 'main'].includes(branch);
}

function isDevelop(branch: string) {
  return branch === 'develop';
}

@Component({
  selector: 'gitgud-history-tree',
  standalone: true,
  imports: [
    TableModule,
    NgIf,
    CommitGraphLineComponent,
  ],
  templateUrl: './history-tree.component.html',
  styleUrl: './history-tree.component.scss',
})
export class HistoryTreeComponent {

  protected branchesCount = 1;
  protected commitTree: CommitTree = {};

  @Input() set gitRepository(gitRepository: GitRepository) {

    const branches = Object.keys(gitRepository.branchesAndLogs)
      // Order branches by last commit date (More recent branch on the left)
      .sort((branchA, branchB) => gitRepository.branchesAndLogs[branchB][0].author.date.getMilliseconds() - gitRepository.branchesAndLogs[branchA][0].author.date.getMilliseconds())
      // Set the checked out branch as first branch
      .sort(branch => branch == gitRepository.currentBranch ? -1 : 0);

    // Build the linear commit history, order commits by date and save their branch
    this.commitTree = HistoryTreeComponent.buildCommitHistoryTree(branches, gitRepository);

    console.log('uuuu', branches, gitRepository.branchesAndLogs);

    //
    // branches.forEach((branch, indexBranch) => {
    //   const branchCommits = gitRepository.branchesAndLogs[branch];
    //
    //   console.log(branchCommits[0]);
    //   this.electronIpcApiService.findMergeBase(gitRepository.directory, [branchCommits[0].oid]).subscribe(([matchOid]) => {
    //     console.warn(branchCommits.find(commit => matchOid == commit.oid));
    //   });
    //
    //   branchCommits.forEach(commit => {
    //     if (!this.commitTree[commit.oid]) {
    //       this.commitTree[commit.oid] = {...commit, bars: {bottom: true, indents: indexBranch, top: true, colorIndex: indexBranch + 1}}
    //     }
    //   })
    // });
    //
    // this.branchesCount = branches.length;
    //
    // console.log(branchesAndOids);

    // branches
    //   .toSorted(branch => branch == gitRepository.currentBranch ? -1 : 0)
    //   .forEach((branch, indexBranch) => {
    //     const branchCommits = gitRepository.branchesAndLogs[branch];
    //
    //     console.log(branchCommits[0]);
    //     this.electronIpcApiService.findMergeBase(gitRepository.directory, [branchCommits[0].oid]).subscribe(([matchOid]) => {
    //       console.warn(branchCommits.find(commit => matchOid == commit.oid));
    //     });
    //
    //     branchCommits.forEach(commit => {
    //       if (!this.commitTree[commit.oid]) {
    //         this.commitTree[commit.oid] = {...commit, bars: {bottom: true, indents: indexBranch, top: true, colorIndex: indexBranch + 1}};
    //       }
    //     })
    //   });

    // this.commitResults = Object.values(gitRepository.branchesAndLogs).flatMap(branch => this.toMyCommitObject(branch, gitRepository.branchesAndLogs[branch]));
  }


  private static addDrawingHints(commitTree: CommitTree) {
    // Make columns for each branch and place commits into it

  }

  /**
   * Builds a history with commits and the branches they belong to.
   * If a commit belongs to many branches, assigns it to the rightest branch (the oldest)
   * @param branches ordered branches (1: checked out branch, ... rest of branches ordered by last commit date)
   * @param gitRepository
   */
  private static buildCommitHistoryTree(branches: string[], gitRepository: GitRepository) {

    const commitTree: CommitTree = {};

    branches.forEach((branch, indexBranch) => {
      const branchCommits = gitRepository.branchesAndLogs[branch];


      // Add commits to the ordered history stack
      branchCommits.forEach(branchCommit => {

        // Create the graph line
        const line = Array(branches.length).fill('') as string[];

        // Place the commit with correct position (column) in line
        line[indexBranch] = '◉';

        // If the commit is not in history, writes it
        if (!commitTree[branchCommit.sha]) {

          commitTree[branchCommit.sha] = {...branchCommit, branch, drawCommitLine: line};

        } else if ((isMain(branch) || isDevelop(branch)) && (isMain(commitTree[branchCommit.sha].branch)) && !isDevelop(commitTree[branchCommit.sha].branch)) {
          // If the commit exists, but belongs to an historic branch (like main / develop) we assign it to these branches in priority

          if (commitTree[branchCommit.sha].body.includes('better commit')) {
            debugger
          }
          commitTree[branchCommit.sha] = {
            ...commitTree[branchCommit.sha],
            branch,
            drawCommitLine: line,
          };
        }
      });

    });

    return commitTree;
  }

  protected byCommitDate = (commit: CommitTreeCommit, commit2: CommitTreeCommit) => commit.author.date.getMilliseconds() < commit2.author.date.getMilliseconds() ? 1 : -1;

  /**
   * Read commits bottom to top and style them (indentation & connections)
   */
    // protected toMyCommitObject = (commitResult: Commit, i: number, allCommitResults: Commit[]): MyCommitObject => {
    //   // const previousCommit = i == 0 ? undefined : allCommitResults[i - 1];
    //   const currentCommit = commitResult;
    //   const nextCommit = (i == allCommitResults.length - 1) ? undefined : allCommitResults[i + 1];
    //
    //   const commitColumn = this.updateCommitsTree(currentCommit, i);
    //
    //   return {
    //     ...currentCommit,
    //     bars: {
    //       bottom: i != 0,
    //       // Finds parent comm
    //       indents: commitColumn,
    //       top: !!nextCommit
    //     },
    //   };
    // }


  protected readonly $commitTreeCommit = (c: CommitTreeCommit) => c
  protected readonly Object = Object;

  // private updateCommitsTree(currentCommit: Commit, commitIndex: number) {
  //   // Init columns
  //   if (commitIndex == 0) {
  //     this.commmitTree = [[currentCommit]];
  //     return 0; // Column 0
  //   }
  //
  //   for (let column = 0; column < this.commmitTree.length; column++) {
  //     // If our current commit is the children of one of the tree columns, we add it to this column and return column index
  //     if (currentCommit.commit.parent.includes(this.commmitTree[column].at(-1)!.oid)) {
  //       this.commmitTree[column].push(currentCommit);
  //       console.log(column, currentCommit.commit.message, currentCommit.oid, currentCommit.commit.parent);
  //       return column;
  //     }
  //   }
  //
  //   // Start new column
  //   this.commmitTree.push([currentCommit]);
  //   console.log(this.commmitTree.length - 1, currentCommit.commit.message);
  //   return this.commmitTree.length - 1;
  // }
}
