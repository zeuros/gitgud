import {ApplicationConfig, importProvidersFrom} from "@angular/core";
import {provideRouter} from "@angular/router";

import {routes} from "./app.routes";
import {provideAnimations} from "@angular/platform-browser/animations";
import {MessageService} from "primeng/api";
import {TranslateLoader, TranslateModule} from "@ngx-translate/core";
import {HttpClient, provideHttpClient} from "@angular/common/http";
import {TranslateHttpLoader} from "@ngx-translate/http-loader";
import {DialogService} from "primeng/dynamicdialog";

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideAnimations(),
    MessageService,
    DialogService,
    provideHttpClient(),
    importProvidersFrom(
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: (http: HttpClient) => new TranslateHttpLoader(http, './assets/i18n/', '.json'),
        deps: [HttpClient],
      },
    })
  ),],
};