import {Component, Input} from '@angular/core';
import {CommitIdentity} from "../../../../lib/github-desktop/model/commit-identity";
import {GravatarUrlPipe} from "../../../../pipes/gravatar-url";
import {NgIf} from "@angular/common";
import {IdenticonPipe} from "../../../../services/identicon-pipe.service";
import {fadeSlideIn} from "../../../../shared/animations";

@Component({
  selector: 'gitgud-avatar',
  imports: [
    GravatarUrlPipe,
    NgIf,
    IdenticonPipe
  ],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
  animations: [fadeSlideIn]
})
export class AvatarComponent {

  @Input() identity!: CommitIdentity;
  @Input() indent!: number;

  avatarLoaded = false;

}
