import { Routes } from "@angular/router";
import {WelcomeScreenComponent} from './components/welcome-screen/welcome-screen.component';
import {RepositoriesViewComponent} from './components/repositories-view/repositories-view.component';

export const routes: Routes = [
  { path: 'welcome-screen', component: WelcomeScreenComponent },
  { path: 'repo', component: RepositoriesViewComponent },
];