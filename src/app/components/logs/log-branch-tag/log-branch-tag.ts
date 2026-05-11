import {Component, input} from '@angular/core';
import {Badge} from 'primeng/badge';
import {Branch} from '../../../lib/github-desktop/model/branch';
import { normalizedBranchName } from "../../../utils/branch-utils";

@Component({
  selector: 'gitgud-log-branch-tag',
  templateUrl: './log-branch-tag.html',
  standalone: true,
  imports: [
    Badge,
  ],
})
export class LogBranchTag {

  positionInBranchList = input(0);
  local = input<Branch | null>(null);
  distant = input<Branch | null>(null);
  extraCount = input(0);

  protected normalizedBranchName = normalizedBranchName;
}
