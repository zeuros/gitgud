import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';

// The main of angular app
bootstrapApplication(AppComponent, appConfig).catch(console.error);
