import {Component, Input, input, model, viewChild} from '@angular/core';
import {DATE_FORMAT} from '../../../utils/constants';
import {CommittedFileChange} from '../../../lib/github-desktop/model/status';
import {Commit} from '../../../lib/github-desktop/model/commit';
import {Tooltip} from 'primeng/tooltip';
import {AvatarComponent} from '../commit-infos/avatar/avatar.component';
import {Button} from 'primeng/button';
import {DatePipe} from '@angular/common';

@Component({
  selector: 'gitgud-commit-card',
  imports: [
    Tooltip,
    AvatarComponent,
    Button,
    DatePipe,
  ],
  templateUrl: './commit-card.component.html',
  styleUrl: './commit-card.component.scss',
  standalone: true,
})
export class CommitCardComponent {
  private shaTooltip = viewChild(Tooltip);

  commit = input<Commit | undefined>(undefined);
  showSha = input(true);
  showParent = input(false);

  protected copyTooltip = 'Copy';

  protected copyToClipboard = (sha: string) => {
    navigator.clipboard.writeText(sha);
    this.copyTooltip = 'Copied';
    setTimeout(() => this.shaTooltip()?.show(), 0);
  };

  protected DATE_FORMAT = DATE_FORMAT;
}
