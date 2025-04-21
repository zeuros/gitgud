import {Component, effect, inject, input} from '@angular/core';
import {CommitFilesChangesService} from "../../../services/electron-cmd-parser-layer/commit-files-changes.service";
import {DisplayRef} from "../../../lib/github-desktop/model/display-ref";
import {FormControl, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {InputText} from "primeng/inputtext";
import {Textarea} from "primeng/textarea";
import {ButtonDirective} from "primeng/button";
import {DatePipe, NgIf} from "@angular/common";
import {isEqual} from "lodash";
import {DATE_FORMAT} from "../../../utils/constants";
import {Tooltip} from "primeng/tooltip";
import {AvatarComponent} from "./avatar/avatar.component";

@Component({
  selector: 'gitgud-commit-infos',
  imports: [
    ReactiveFormsModule,
    InputText,
    Textarea,
    ButtonDirective,
    NgIf,
    DatePipe,
    Tooltip,
    AvatarComponent
  ],
  templateUrl: './commit-infos.component.html',
  styleUrl: './commit-infos.component.scss'
})
export class CommitInfosComponent {

  private commitFilesChangesService = inject(CommitFilesChangesService);

  selectedCommits = input<DisplayRef[]>([]);

  protected editCommitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });
  protected initialValue: typeof this.editCommitForm.value = {};


  constructor() {
    effect(() => {
      if (this.selectedCommits().length == 1) {
        this.commitFilesChangesService.getChangedFilesForGivenCommit(this.selectedCommits()[0].sha).subscribe(console.log);
        this.editCommitForm.setValue({
          summary: this.selectedCommits()[0].summary,
          description: this.selectedCommits()[0].body
        });
        this.initialValue = this.editCommitForm.value;

      } else if (this.selectedCommits().length > 1)
        console.warn('TODO');
    });
  }

  protected readonly isEqual = isEqual;

  protected readonly DATE_FORMAT = DATE_FORMAT;
}
