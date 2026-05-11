import {Component, input} from '@angular/core';
import {Branch} from '../../../lib/github-desktop/model/branch';
import {normalizedBranchName} from '../../../utils/branch-utils';

@Component({
  selector: 'gitgud-log-branch-tag',
  templateUrl: './log-branch-tag.html',
  styleUrl: './log-branch-tag.scss',
  standalone: true,
})
export class LogBranchTag {

  local = input<Branch | null>(null);
  distant = input<Branch | null>(null);

  protected normalizedBranchName = normalizedBranchName;
}
