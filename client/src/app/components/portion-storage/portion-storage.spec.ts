import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PortionStorage } from './portion-storage';

describe('PortionStorage', () => {
  let component: PortionStorage;
  let fixture: ComponentFixture<PortionStorage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PortionStorage],
    }).compileComponents();

    fixture = TestBed.createComponent(PortionStorage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
