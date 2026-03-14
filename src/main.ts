import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';
import {ErrorHandler} from '@angular/core';

bootstrapApplication(AppComponent, appConfig).then(appRef => {

  const globalErrorHandler = appRef.injector.get(ErrorHandler);

  window.addEventListener('unhandledrejection', (event) => {
    globalErrorHandler.handleError(event.reason);
    event.preventDefault();
  });
});
