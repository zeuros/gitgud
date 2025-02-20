import {Injectable} from '@angular/core';
import {GitApiService} from "./git-api.service";
import {ParserService} from "./parser.service";
import {CommitIdentity} from "../models/commit-identity";
import {Branch, BranchType, IBranchTip} from "../models/branch";
import {map, Observable} from "rxjs";
import {PREFIXES} from "../utils/constants";
import {formatArg} from "../utils/log-utils";

@Injectable({
  providedIn: 'root'
})
export class BranchService {

  readonly fields = {
    fullName: '%(refname)',
    shortName: '%(refname:short)',
    upstreamShortName: '%(upstream:short)',
    sha: '%(objectname)',
    author: '%(author)',
    symRef: '%(symref)',
    head: '%(HEAD)',
  };

  branchParser;
  remoteHeadPointer?: string;

  constructor(
    private gitApiService: GitApiService,
    parserService: ParserService,
  ) {
    this.branchParser = parserService.createForEachRefParser(this.fields);
  }

  getBranches = (repositoryPath: string): Observable<ReadonlyArray<Branch>> =>
    this.gitApiService.git(['for-each-ref', ...PREFIXES, formatArg(this.fields)], repositoryPath)
      .pipe(map(result =>

        this.branchParser(result)
          .map(branch => {

            // Exclude symbolic refs from the branch list (but use it to guess the origin/HEAD branch)
            // Also exclude local HEAD branch since we have the %(HEAD) field to get this info
            if (branch.symRef.length > 0 || branch.fullName == 'refs/heads/origin/HEAD') {
              if (branch.fullName.includes('refs/remotes/origin/HEAD'))
                this.remoteHeadPointer = branch.symRef;

              return undefined;
            }

            const author = CommitIdentity.parseIdentity(branch.author);
            const tip: IBranchTip = {sha: branch.sha, author};

            const type = branch.fullName.startsWith('refs/heads') ? BranchType.Local : BranchType.Remote

            const upstream = branch.upstreamShortName.length > 0 ? branch.upstreamShortName : null

            return new Branch(branch.shortName, upstream, tip, type, branch.fullName, branch.head == '*')
          })
          .filter((v): v is Branch => !!v) // Clean symRef branch
          .map(branch => { // If a branch is pointed by origin/HEAD or HEAD, store the info into branch.
            if (branch.ref == this.remoteHeadPointer) // if branch origin/main is pointed by origin/HEAD
              return {...branch, isHeadPointed: true};

            return branch;
          })
      ));

}
