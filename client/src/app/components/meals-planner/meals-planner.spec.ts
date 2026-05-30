import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MealsPlanner } from './meals-planner';

describe('MealsPlanner', () => {
  let component: MealsPlanner;
  let fixture: ComponentFixture<MealsPlanner>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MealsPlanner],
    }).compileComponents();

    fixture = TestBed.createComponent(MealsPlanner);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
