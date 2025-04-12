import {Component, inject, input} from '@angular/core';
import {toObservable} from "@angular/core/rxjs-interop";
import {notUndefined} from "../../utils/utils";
import {filter, switchMap} from "rxjs";
import {CommitFilesChangesService} from "../../services/electron-cmd-parser-layer/commit-files-changes.service";
import {ReactiveFormsModule} from "@angular/forms";
import {NgIf} from "@angular/common";
import {CommitInfosComponent} from "./commit-infos/commit-infos.component";
import {MakeACommitComponent} from "./make-a-commit/make-a-commit.component";

@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    NgIf,
    CommitInfosComponent,
    MakeACommitComponent
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss'
})
export class CommitSectionComponent {

  selectedCommits = input<string[]>();

}
