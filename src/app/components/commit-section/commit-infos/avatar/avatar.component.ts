import {Component, Input} from '@angular/core';
import {commitColor, initials} from '../../../../utils/commit-utils';
import {Avatar} from "primeng/avatar";
import {CommitIdentity} from "../../../../lib/github-desktop/model/commit-identity";
import {GravatarUrlPipe} from "../../../../pipes/gravatar-url";
import {NgIf, NgOptimizedImage} from "@angular/common";

@Component({
  selector: 'gitgud-avatar',
  imports: [
    Avatar,
    GravatarUrlPipe,
    NgIf,
    NgOptimizedImage
  ],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss'
})
export class AvatarComponent {

  @Input() identity!: CommitIdentity;
  @Input() indent!: number;

  protected readonly commitColor = commitColor;
  protected readonly initials = initials;
  avatarLoaded = false;

}
