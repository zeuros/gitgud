import {ApplicationConfig, ErrorHandler, MAX_ANIMATION_TIMEOUT, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {MessageService} from 'primeng/api';
import {provideTranslateService} from '@ngx-translate/core';
import {provideHttpClient} from '@angular/common/http';
import {DialogService} from 'primeng/dynamicdialog';
import {providePrimeNG} from 'primeng/config';
import {GlobalErrorHandler} from './utils/error-management.utils';
import Aura from '@primeuix/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          cssLayer: {
            name: 'primeng',
            order: 'primeng, my-theme',
          },
        },
      },
    }),
    provideZoneChangeDetection(),
    {provide: MAX_ANIMATION_TIMEOUT, useValue: 200}, // Animations last 200ms long max
    {provide: ErrorHandler, useClass: GlobalErrorHandler},
    provideTranslateService({fallbackLang: 'en'}),
    MessageService,
    DialogService,
    provideHttpClient(),
  ],
};