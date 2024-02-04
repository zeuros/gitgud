import { Component } from '@angular/core';
import { Neu } from "../../../main";

@Component({
  selector: 'app-sample-component',
  standalone: true,
  templateUrl: './sample.component.html',
  styleUrl: './sample.component.scss'
})
export class SampleComponent {

  protected test = () => {
    Neu.os.showMessageBox('Welcome', 'Hello Neutralinojs');
  };

}
