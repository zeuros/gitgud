import {Component, inject} from '@angular/core';
import {Splitter} from "primeng/splitter";
import {Divider} from "primeng/divider";
import {FormControl, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {Textarea} from "primeng/textarea";
import {ButtonDirective} from "primeng/button";
import {InputText} from "primeng/inputtext";
import {CommitFilesChangesService} from "../../../services/electron-cmd-parser-layer/commit-files-changes.service";

@Component({
  selector: 'gitgud-make-a-commit',
  imports: [
    Splitter,
    Divider,
    ReactiveFormsModule,
    Textarea,
    ButtonDirective,
    InputText
  ],
  templateUrl: './make-a-commit.component.html',
  styleUrl: './make-a-commit.component.scss'
})
export class MakeACommitComponent {

  private commitFilesChangesService = inject(CommitFilesChangesService);

  protected commitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });

  constructor() {
    this.commitFilesChangesService.getIndexChanges().subscribe(r => console.log('getIndexChanges', r));
  }

}
