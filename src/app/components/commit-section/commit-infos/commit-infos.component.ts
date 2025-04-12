import {Component, effect, inject, input} from '@angular/core';
import {NgIf} from "@angular/common";
import {CommitFilesChangesService} from "../../../services/electron-cmd-parser-layer/commit-files-changes.service";

@Component({
  selector: 'gitgud-commit-infos',
  imports: [
    NgIf
  ],
  templateUrl: './commit-infos.component.html',
  styleUrl: './commit-infos.component.scss'
})
export class CommitInfosComponent {

  private commitFilesChangesService = inject(CommitFilesChangesService);

  selectedCommits = input<string[]>([]);

  constructor() {
    effect(() => {
      if (this.selectedCommits().length)
        this.commitFilesChangesService.getChangedFilesForGivenCommit(this.selectedCommits()[0]).subscribe(console.log);
    })
  }

}
