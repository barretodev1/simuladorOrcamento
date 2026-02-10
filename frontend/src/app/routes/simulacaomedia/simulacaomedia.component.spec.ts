import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimulacaomediaComponent } from './simulacaomedia.component';

describe('SimulacaomediaComponent', () => {
  let component: SimulacaomediaComponent;
  let fixture: ComponentFixture<SimulacaomediaComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulacaomediaComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimulacaomediaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
