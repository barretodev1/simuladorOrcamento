import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimulacaorecorrenteComponent } from './simulacaorecorrente.component';

describe('SimulacaorecorrenteComponent', () => {
  let component: SimulacaorecorrenteComponent;
  let fixture: ComponentFixture<SimulacaorecorrenteComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimulacaorecorrenteComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SimulacaorecorrenteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
