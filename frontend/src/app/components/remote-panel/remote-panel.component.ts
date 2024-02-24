import { Component, Input, OnDestroy } from '@angular/core';
import { AccordionModule } from "primeng/accordion";
import { BadgeModule } from "primeng/badge";
import { TerminalService } from "primeng/terminal";
import { Subject } from "rxjs";
import { GitRepository } from "../../models/git-repository";
import { GitgudTerminalModule } from "../shared/terminal/gitgud-terminal.module";


@Component({
    selector: 'gitgud-remote-panel',
    standalone: true,
    imports: [
        AccordionModule,
        BadgeModule,
        GitgudTerminalModule,
        GitgudTerminalModule
    ],
    providers: [TerminalService],
    templateUrl: './remote-panel.component.html',
    styleUrl: './remote-panel.component.scss'
})
export class RemotePanelComponent implements OnDestroy {

    unsubscribe$ = new Subject();
    @Input() repository?: GitRepository;


    ngOnDestroy(): void {
        this.unsubscribe$.next(undefined);
        this.unsubscribe$.complete();
    }

}
