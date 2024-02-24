import { TestBed } from '@angular/core/testing';

import { GudTerminalService } from './gud-terminal.service';

describe('TerminalService', () => {
  let service: GudTerminalService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(GudTerminalService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
