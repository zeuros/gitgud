import {Component, Input} from '@angular/core';
import {CommitTreeCommit} from "../../../utils/graph-utils";
import {NgForOf, NgIf} from "@angular/common";

@Component({
  selector: 'gitgud-commit-graph-line',
  standalone: true,
  imports: [
    NgForOf,
    NgIf
  ],
  templateUrl: './commit-graph-line.component.html',
  styleUrl: './commit-graph-line.component.scss'
})
export class CommitGraphLineComponent {

  @Input() commit!: CommitTreeCommit;

}
