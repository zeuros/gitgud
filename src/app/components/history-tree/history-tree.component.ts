import {Component, Input} from '@angular/core';
import {GitRepository} from "../../models/git-repository";
import {TableModule} from "primeng/table";
import {CommitObject, ReadCommitResult} from "isomorphic-git";

@Component({
  selector: 'gitgud-history-tree',
  standalone: true,
  imports: [
    TableModule,
  ],
  templateUrl: './history-tree.component.html',
  styleUrl: './history-tree.component.scss',
})
export class HistoryTreeComponent {

  @Input() gitRepository?: GitRepository;

  protected readonly $commit = (c: CommitObject) => c
  protected readonly getCommitObject = (c: ReadCommitResult) => c.commit

}
