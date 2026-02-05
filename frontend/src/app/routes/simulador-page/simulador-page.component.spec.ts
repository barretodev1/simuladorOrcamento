import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimuladorPageComponent } from './simulador-page.component';

describe('SimuladorPageComponent', () => {
  let component: SimuladorPageComponent;
  let fixture: ComponentFixture<SimuladorPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimuladorPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimuladorPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
