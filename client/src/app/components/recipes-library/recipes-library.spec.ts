import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipesLibrary } from './recipes-library';

describe('RecipesLibrary', () => {
  let component: RecipesLibrary;
  let fixture: ComponentFixture<RecipesLibrary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipesLibrary],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipesLibrary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
