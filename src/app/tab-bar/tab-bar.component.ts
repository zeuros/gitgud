import { Component } from '@angular/core';
import { ToolbarModule } from "primeng/toolbar";
import { SplitButtonModule } from "primeng/splitbutton";

@Component({
  selector: 'gitgud-tab-bar',
  standalone: true,
  imports: [
    ToolbarModule,
    SplitButtonModule
  ],
  templateUrl: './tab-bar.component.html',
  styleUrl: './tab-bar.component.scss'
})
export class TabBarComponent {

}
