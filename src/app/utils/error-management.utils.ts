import {ErrorHandler} from '@angular/core';

export class GlobalErrorHandler implements ErrorHandler {
  handleError(error: unknown): void {
    console.error('[GlobalErrorHandler]', error);
    if (error instanceof Error) {
      console.error('[message]', error.message);
      console.error('[stack]', error.stack);
    }
  }
}
