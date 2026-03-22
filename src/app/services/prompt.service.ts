import {inject, Injectable} from '@angular/core';
import {DialogService} from 'primeng/dynamicdialog';
import {map, tap} from 'rxjs';
import {PromptDialogComponent} from '../components/dialogs/prompt-dialog/prompt-dialog.component';

@Injectable({providedIn: 'root'})
export class PromptService {

  private readonly dialog = inject(DialogService);

  open = (label: string, required = true) =>
    this.dialog.open(PromptDialogComponent, {
      header: label,
      width: '400px',
      modal: true,
      data: {label, required},
    })!.onClose.pipe(map((r?: string) => r?.trim().length ? r : null), tap(this.closeAll));

  // Clear dialog references to avoid reuse
  closeAll = () => this.dialog.dialogComponentRefMap.clear();
}