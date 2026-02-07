import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MenuOptionsComponent } from './menu-options.component';

describe('MenuOptionsComponent', () => {
  let component: MenuOptionsComponent;
  let fixture: ComponentFixture<MenuOptionsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MenuOptionsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MenuOptionsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
