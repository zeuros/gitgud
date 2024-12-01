import {Component, Input, OnInit} from '@angular/core';
import {AccordionModule} from "primeng/accordion";
import {BadgeModule} from "primeng/badge";
import {TerminalService} from "primeng/terminal";
import {JsonPipe, NgForOf} from "@angular/common";
import {GitRepository} from "../../models/git-repository";
import {TreeModule} from "primeng/tree";
import {branchToTreeNode} from "../../utils/repository-utils";
import {ContextMenuModule} from "primeng/contextmenu";
import {MenuItem, TreeNode} from "primeng/api";
import {single} from "rxjs";
import {leaves} from "../../utils/utils";
import {PopupService} from "../../services/popup.service";


@Component({
    selector: 'gitgud-remote-panel',
    standalone: true,
    imports: [
        AccordionModule,
        BadgeModule,
        TreeModule,
        ContextMenuModule,
    ],
    providers: [TerminalService],
    templateUrl: './remote-panel.component.html',
    styleUrl: './remote-panel.component.scss'
})
export class RemotePanelComponent implements OnInit {

    @Input() gitRepository!: GitRepository;

    protected selectedLocalBranch: any;
    protected selectedRemoteBranch: any;
    protected localBranches: TreeNode<string>[] = [];
    protected remoteBranches: TreeNode<string>[] = [];

    constructor(
        private popupService: PopupService,
    ) {
    }

    ngOnInit(): void {
        this.localBranches = Object.keys(this.gitRepository.branchesAndLogs).map(b => branchToTreeNode(b));
        this.remoteBranches = this.gitRepository.remoteBranches?.filter(b => b != 'HEAD').map(b => branchToTreeNode(b));
    }


    contextMenu: MenuItem[] = [
        {label: 'Pull (fast-forward if possible)', icon: 'pi pi-cloud-download', command: () => this.popupService.info('Pull (fast-forward if possible) selected')},
        {label: 'Push (Set Upstream)', icon: 'pi pi-cloud-upload', command: () => this.popupService.info('Push (Set Upstream) selected')},
        {label: 'Create branch here', icon: 'pi pi-plus', command: () => this.popupService.info('Create branch here selected')},
        {label: 'Reset main to this commit', icon: 'pi pi-step-backward', command: () => this.popupService.info('Reset main to this commit selected')},
        {label: 'Edit commit message', icon: 'pi pi-pencil', command: () => this.popupService.info('Edit commit message selected')},
        {label: 'Revert commit', icon: 'pi pi-replay', command: () => this.popupService.info('Revert commit selected')},
        {label: 'Drop commit', icon: 'pi pi-times-circle', command: () => this.popupService.info('Drop commit selected')},
        {label: 'Move commit down', icon: 'pi pi-arrow-down', command: () => this.popupService.info('Move commit down selected')},
        {label: 'Apply patch', icon: 'pi pi-file-edit', command: () => this.popupService.info('Apply patch selected')},
        {label: 'Rename the branch', icon: 'pi pi-pencil', command: () => this.popupService.info('Rename the branch selected')},
        {label: 'Delete the branch', icon: 'pi pi-times-circle', command: () => this.popupService.info('Delete the branch selected')},
        {label: 'Copy branch name', icon: 'pi pi-copy', command: () => this.popupService.info('Copy branch name selected')},
        {label: 'Copy commit sha', icon: 'pi pi-receipt', command: () => this.popupService.info('Copy commit sha selected')},
    ];


    checkoutBranch(branch: TreeNode<string>, allBranches: TreeNode<string>[]) {
        leaves(allBranches).forEach(b => delete b.styleClass);
        branch.styleClass = 'selected-branch';
         this.popupService.info(`Branch ${branch.data} checked out`);
    }

    $node = (node: TreeNode<string>) => node;
    protected readonly single = single;
}
