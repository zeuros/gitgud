import { Component, Input, OnDestroy } from '@angular/core';
import { AccordionModule } from "primeng/accordion";
import { BadgeModule } from "primeng/badge";
import { TerminalService } from "primeng/terminal";
import { Subject } from "rxjs";
import { GitRepository } from "../../models/git-repository";


@Component({
    selector: 'gitgud-remote-panel',
    standalone: true,
    imports: [
        AccordionModule,
        BadgeModule,
    ],
    providers: [TerminalService],
    templateUrl: './remote-panel.component.html',
    styleUrl: './remote-panel.component.scss'
})
export class RemotePanelComponent {


}
