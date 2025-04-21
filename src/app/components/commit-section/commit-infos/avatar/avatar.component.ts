import {Component, Input} from '@angular/core';
import {CommitIdentity} from "../../../../lib/github-desktop/model/commit-identity";
import {GravatarUrlPipe} from "../../../../pipes/gravatar-url";
import {NgIf, NgOptimizedImage} from "@angular/common";
import {IdenticonPipe} from "../../../../services/identicon-pipe.service";

@Component({
  selector: 'gitgud-avatar',
  imports: [
    GravatarUrlPipe,
    NgIf,
    NgOptimizedImage,
    IdenticonPipe
  ],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss'
})
export class AvatarComponent {

  @Input() identity!: CommitIdentity;
  @Input() indent!: number;

  avatarLoaded = false;

}
