import {ChangeDetectionStrategy, Component, input} from '@angular/core';
import {GitTag} from '../../../../models/git-tag';

@Component({
  selector: 'gitgud-log-tag-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './log-tag-chip.component.html',
  styleUrl: './log-tag-chip.component.scss',
  standalone: true,
})
export class LogTagChip {
  local = input<GitTag | null>(null);
  distant = input<GitTag | null>(null);
}
