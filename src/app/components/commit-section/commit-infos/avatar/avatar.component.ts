import {Component, input} from '@angular/core';
import {CommitIdentity} from '../../../../lib/github-desktop/model/commit-identity';
import {GravatarUrlPipe} from '../../../../pipes/gravatar-url';
import {IdenticonPipe} from '../../../../services/identicon-pipe.service';

@Component({
  selector: 'gitgud-avatar',
  imports: [
    GravatarUrlPipe,
    IdenticonPipe,
  ],
  templateUrl: './avatar.component.html',
  styleUrl: './avatar.component.scss',
})
export class AvatarComponent {

  readonly identity = input<CommitIdentity | undefined>(undefined);
  protected avatarLoaded = false;

}
