import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GroceryList } from './grocery-list';

describe('GroceryList', () => {
  let component: GroceryList;
  let fixture: ComponentFixture<GroceryList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GroceryList],
    }).compileComponents();

    fixture = TestBed.createComponent(GroceryList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
