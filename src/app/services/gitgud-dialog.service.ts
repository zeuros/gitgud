import {Injectable, Type} from '@angular/core';
import {DialogService, type DynamicDialogConfig} from 'primeng/dynamicdialog';

const DIALOG_DEFAULTS: DynamicDialogConfig = {
  modal: true,
  dismissableMask: true,
  closable: true,
  closeOnEscape: true,
};

@Injectable()
export class GitGudDialogService extends DialogService {
  override open<T>(component: Type<T>, config: DynamicDialogConfig = {}) {
    return super.open(component, {...DIALOG_DEFAULTS, ...config});
  }
}
