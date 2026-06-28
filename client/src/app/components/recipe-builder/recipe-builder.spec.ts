import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeBuilder } from './recipe-builder';

describe('RecipeBuilder', () => {
  let component: RecipeBuilder;
  let fixture: ComponentFixture<RecipeBuilder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeBuilder],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeBuilder);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
