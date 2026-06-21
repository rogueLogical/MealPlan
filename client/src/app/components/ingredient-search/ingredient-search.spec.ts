import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IngredientSearch } from './ingredient-search';

describe('IngredientSearch', () => {
  let component: IngredientSearch;
  let fixture: ComponentFixture<IngredientSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IngredientSearch],
    }).compileComponents();

    fixture = TestBed.createComponent(IngredientSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
