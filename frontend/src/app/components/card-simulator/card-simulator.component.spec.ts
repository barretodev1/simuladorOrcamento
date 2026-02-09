import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardSimulatorComponent } from './card-simulator.component';

describe('CardSimulatorComponent', () => {
  let component: CardSimulatorComponent;
  let fixture: ComponentFixture<CardSimulatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardSimulatorComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardSimulatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
