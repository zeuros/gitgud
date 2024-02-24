import {bootstrapApplication} from '@angular/platform-browser';
import {appConfig} from './app/app.config';
import {AppComponent} from './app/app.component';
import {init, events, app} from '@neutralinojs/lib';

init();

events.on('windowClose', () => app.exit());

bootstrapApplication(AppComponent, appConfig).catch(console.error);
