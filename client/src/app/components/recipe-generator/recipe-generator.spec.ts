import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeGenerator } from './recipe-generator';

describe('RecipeGenerator', () => {
  let component: RecipeGenerator;
  let fixture: ComponentFixture<RecipeGenerator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeGenerator],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeGenerator);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
