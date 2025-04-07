import {Component, inject, input} from '@angular/core';
import {toObservable} from "@angular/core/rxjs-interop";
import {notUndefined} from "../../utils/utils";
import {filter} from "rxjs";
import {CommitFilesChangesService} from "../../services/electron-cmd-parser-layer/commit-files-changes.service";
import {Splitter} from "primeng/splitter";
import {Textarea} from "primeng/textarea";
import {InputText} from "primeng/inputtext";
import {ButtonDirective} from "primeng/button";
import {FormControl, FormGroup, ReactiveFormsModule} from "@angular/forms";
import {Accordion, AccordionContent, AccordionHeader, AccordionPanel} from "primeng/accordion";
import {Divider} from "primeng/divider";

@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    Splitter,
    Textarea,
    InputText,
    ButtonDirective,
    ReactiveFormsModule,
    Accordion,
    AccordionPanel,
    AccordionHeader,
    AccordionContent,
    Divider
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss'
})
export class CommitSectionComponent {

  selectedCommits = input<string[]>();

  private commitFilesChangesService = inject(CommitFilesChangesService);
  private selectedCommit$ = toObservable(this.selectedCommits).pipe(filter(notUndefined));
  commitForm = new FormGroup({
    summary: new FormControl(''),
    description: new FormControl(''),
  });

  constructor() {
    this.selectedCommit$.subscribe(selectedCommitsShas => {
      this.commitFilesChangesService.getChangedFilesForGivenCommit(selectedCommitsShas[0]).subscribe(console.log);
    })
  }

}
