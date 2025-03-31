import {Component, Input} from '@angular/core';
import {AccordionModule} from "primeng/accordion";
import {BadgeModule} from "primeng/badge";
import {TerminalService} from "primeng/terminal";
import {GitRepository} from "../../models/git-repository";
import {TreeModule} from "primeng/tree";
import {ContextMenuModule} from "primeng/contextmenu";
import {MenuItem, TreeNode} from "primeng/api";
import {PopupService} from "../../services/popup.service";
import {Branch} from "../../models/branch";
import {GitRepositoryService} from "../../services/git-repository.service";
import {branchesToTree, local, remote} from "../../utils/branch-utils";


@Component({
  selector: 'gitgud-branches',
  standalone: true,
  imports: [
    AccordionModule,
    BadgeModule,
    TreeModule,
    ContextMenuModule,
  ],
  providers: [TerminalService],
  templateUrl: './branches.component.html',
  styleUrl: './branches.component.scss'
})
export class BranchesComponent {

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

  protected localBranches: TreeNode<Branch>[] = [];
  protected remoteBranches: TreeNode<Branch>[] = [];
  protected selectedNode?: TreeNode<Branch>;

  constructor(
    private popupService: PopupService,
    private gitRepositoryService: GitRepositoryService,
  ) {
  }

  @Input() set gitRepository(gitRepository: GitRepository) {
    this.localBranches = branchesToTree(gitRepository.branches.filter(local));
    this.remoteBranches = branchesToTree(gitRepository.branches.filter(remote));
  }


  selectBranchCommit = (branch: TreeNode<Branch>) =>
    this.gitRepositoryService.updateCurrentRepository({highlightedCommitSha: branch?.data?.tip.sha});


  // checkoutBranch = (branch: TreeNode<Branch>) => {
  //   this.gitRepositoryService.updateCurrentRepository({checkedOutBranch: branch.data})
  //
  //   leaves(this.allBranchNodes).forEach(b => b.styleClass?.replace('selected-branch', ''));
  //   branch.styleClass = 'selected-branch';
  //
  //   this.popupService.info(`Branch ${branch.data?.upstream} checked out`);
  // };

  protected $branchNode = (branchNode: any): TreeNode<Branch> => branchNode;

}
