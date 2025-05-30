import {Component, input} from '@angular/core';
import {ReactiveFormsModule} from "@angular/forms";
import {CommitInfosComponent} from "./commit-infos/commit-infos.component";
import {MakeACommitComponent} from "./make-a-commit/make-a-commit.component";
import {DisplayRef} from "../../lib/github-desktop/model/display-ref";

@Component({
  selector: 'gitgud-commit-section',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommitInfosComponent,
    MakeACommitComponent
  ],
  templateUrl: './commit-section.component.html',
  styleUrl: './commit-section.component.scss'
})
export class CommitSectionComponent {

  readonly selectedCommits = input<DisplayRef[]>([]);

}
