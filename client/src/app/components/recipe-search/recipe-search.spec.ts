import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeSearch } from './recipe-search';

describe('RecipeSearch', () => {
  let component: RecipeSearch;
  let fixture: ComponentFixture<RecipeSearch>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeSearch],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeSearch);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
