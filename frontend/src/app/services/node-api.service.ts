import { Injectable } from '@angular/core';
import { from } from "rxjs";

export type RustCommand = {
    program: string,
    args: string[],
    directory: string,
}

@Injectable({
  providedIn: 'root'
})
export class NodeApiService {

}
