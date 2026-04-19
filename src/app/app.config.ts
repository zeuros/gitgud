/*
 * GitGud - A Git GUI client
 * Copyright (C) 2026 zeuros
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

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