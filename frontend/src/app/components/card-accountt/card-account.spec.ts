import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CardAccountt } from './card-accountt';

describe('CardAccountt', () => {
  let component: CardAccountt;
  let fixture: ComponentFixture<CardAccountt>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardAccountt]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CardAccountt);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});