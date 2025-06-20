import {ApplicationConfig, importProvidersFrom} from '@angular/core';
import {provideRouter} from '@angular/router';
import {routes} from './app.routes';
import {MessageService} from 'primeng/api';
import {TranslateLoader, TranslateModule} from '@ngx-translate/core';
import {HttpClient, provideHttpClient} from '@angular/common/http';
import {TranslateHttpLoader} from '@ngx-translate/http-loader';
import {DialogService} from 'primeng/dynamicdialog';
import {provideAnimationsAsync} from '@angular/platform-browser/animations/async';
import {providePrimeNG} from 'primeng/config';
import Aura from '@primeng/themes/aura';
import {MonacoEditorModule} from 'ngx-monaco-editor-v2';

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
    importProvidersFrom(
      MonacoEditorModule.forRoot({baseUrl: window.location.origin + '/assets/monaco/min/vs', requireConfig: {preferScriptTags: true}}),
      TranslateModule.forRoot({ // TODO: use translation in app (see
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: (http: HttpClient) => new TranslateHttpLoader(http, './assets/i18n/', '.json'),
          deps: [HttpClient],
        },
      }),
    ),
    MessageService,
    DialogService,
    provideHttpClient(),
  ],
};