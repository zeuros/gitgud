import {Component, Input} from '@angular/core';
import {GitRepository} from "../../models/git-repository";
import {TableModule} from "primeng/table";
import {NgIf} from "@angular/common";
import {Commit} from "../../models/commit";

type MyCommitObject = Commit & {
  bars: {
    top: boolean,
    bottom: boolean,
    indents: number,
    colorIndex: number,
  }
};

@Component({
  selector: 'gitgud-history-tree',
  standalone: true,
  imports: [
    TableModule,
    NgIf,
  ],
  templateUrl: './history-tree.component.html',
  styleUrl: './history-tree.component.scss',
})
export class HistoryTreeComponent {

  protected branchesCount = 1;
  protected commitTree: { [oid: string]: MyCommitObject } = {};

  @Input() set gitRepository(gitRepository: GitRepository) {
    // const branches = Object.keys(gitRepository.branchesAndLogs);

    // this.branchesCount = branches.length;

    // branches
    //   .toSorted(branch => branch == gitRepository.currentBranch ? -1 : 0)
    //   .forEach((branch, indexBranch) => {
    //     const branchCommits = gitRepository.branchesAndLogs[branch];
    //
    //     branchCommits.forEach(commit => {
    //       if (!this.commitTree[commit.oid]) {
    //         this.commitTree[commit.oid] = {...commit, bars: {bottom: true, indents: indexBranch, top: true, colorIndex: indexBranch + 1}}
    //       }
    //     })
    //   });

    // this.commitResults = Object.values(gitRepository.branchesAndLogs).flatMap(branch => this.toMyCommitObject(branch, gitRepository.branchesAndLogs[branch]));
  }

  // protected byCommitDate = (commit: MyCommitObject, commit2: MyCommitObject) => commit.commit.author.timestamp < commit2.commit.author.timestamp ? 1 : -1;

  /**
   * Read commits bottom to top and style them (indentation & connections)
   */
    // protected toMyCommitObject = (commitResult: ReadCommitResult, i: number, allCommitResults: ReadCommitResult[]): MyCommitObject => {
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

  protected readonly Object = Object;

  // private updateCommitsTree(currentCommit: ReadCommitResult, commitIndex: number) {
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

  protected readonly $commitResult = (c: MyCommitObject) => c

}
