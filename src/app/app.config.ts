import {ApplicationConfig, ErrorHandler, provideZoneChangeDetection} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {MessageService} from 'primeng/api';
import {provideTranslateService} from '@ngx-translate/core';
import {provideHttpClient} from '@angular/common/http';
import {DialogService} from 'primeng/dynamicdialog';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {providePrimeNG} from 'primeng/config';
import {GlobalErrorHandler} from './utils/error-management.utils';
import Aura from '@primeng/themes/aura';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimationsAsync(),
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
    {provide: ErrorHandler, useClass: GlobalErrorHandler},
    provideTranslateService({fallbackLang: 'en'}),
    MessageService,
    DialogService,
    provideHttpClient(),
  ],
};