import {Component, input} from '@angular/core';
import {Branch} from '../../../../lib/github-desktop/model/branch';
import {normalizedBranchName} from '../../../../utils/branch-utils';

@Component({
  selector: 'gitgud-log-branch-chip',
  templateUrl: './log-branch-chip.component.html',
  styleUrl: './log-branch-chip.component.scss',
  standalone: true,
})
export class LogBranchChip {

  local = input<Branch | null>(null);
  distant = input<Branch | null>(null);

  protected normalizedBranchName = normalizedBranchName;
}
