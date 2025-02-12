import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-sample-translated-component',
  templateUrl: './sample-translated.component.html',
  standalone: true,
  styleUrls: ['./sample-translated.component.scss']
})
export class SampleTranslatedComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
    console.log('SampleTranslatedComponent INIT');
  }

}
