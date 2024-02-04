import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import * as neutralinojs from "@neutralinojs/lib";

// Use typed Neutralino as Neu in rest of app
export const Neu = Neutralino as typeof neutralinojs;

Neu.init();

Neu.events.on('windowClose', () => Neu.app.exit());

bootstrapApplication(AppComponent, appConfig).catch(console.error);
