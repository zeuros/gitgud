import { Component, inject } from '@angular/core';
import {FormControl, ReactiveFormsModule } from '@angular/forms';
import {Button} from 'primeng/button';
import {InputText} from 'primeng/inputtext';
import {DynamicDialogConfig, DynamicDialogRef} from 'primeng/dynamicdialog';

@Component({
  selector: 'gitgud-prompt-dialog',
  imports: [ReactiveFormsModule, Button, InputText],
  template: `
    <div class="flex flex-column gap-3 pt-2">
      <input pInputText [formControl]="textInput" (keydown.enter)="confirm()" autofocus/>
      <div class="flex gap-2 justify-content-end">
        <p-button label="Cancel" [text]="true" severity="secondary" (click)="cancel()"/>
        <p-button label="Confirm" (click)="confirm()" [disabled]="required && !textInput.value.length"/>
      </div>
    </div>
  `,
})
export class PromptDialogComponent {
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);

  protected readonly required: boolean = this.config.data?.required ?? true;
  protected readonly textInput = new FormControl('', { nonNullable: true });

  protected confirm = () => this.ref.close(this.textInput.value);
  protected cancel = () => this.ref.close(null);
}