import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommitSectionComponent } from './commit-section.component';

describe('CommitSectionComponent', () => {
  let component: CommitSectionComponent;
  let fixture: ComponentFixture<CommitSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommitSectionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CommitSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
