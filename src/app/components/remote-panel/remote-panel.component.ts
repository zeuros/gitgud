import { Component } from '@angular/core';
import { AccordionModule } from "primeng/accordion";
import { BadgeModule } from "primeng/badge";

@Component({
  selector: 'gitgud-remote-panel',
  standalone: true,
  imports: [
    AccordionModule,
    BadgeModule
  ],
  templateUrl: './remote-panel.component.html',
  styleUrl: './remote-panel.component.scss'
})
export class RemotePanelComponent {

  constructor() {
  }
}
