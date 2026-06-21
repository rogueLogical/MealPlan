import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IngredientForm } from './ingredient-form';

describe('IngredientForm', () => {
  let component: IngredientForm;
  let fixture: ComponentFixture<IngredientForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientForm],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
