import {ErrorHandler, inject} from '@angular/core';
import {PopupService} from '../services/popup.service';

export class GlobalErrorHandler implements ErrorHandler {

  private readonly popupService = inject(PopupService);

  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);

    if (error instanceof Error) {
      this.popupService.err(error.message);
    }
  }
}
