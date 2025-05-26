import {Injectable} from '@angular/core';
import {CommittedFileChange} from '../lib/github-desktop/model/status';
import {Subject} from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class FileDiffPanelService {

  committedFileClicked = new Subject<CommittedFileChange>();

}
