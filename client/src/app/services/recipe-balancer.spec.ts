import { TestBed } from '@angular/core/testing';

import { RecipeBalancer } from './recipe-balancer';

describe('RecipeBalancer', () => {
  let service: RecipeBalancer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RecipeBalancer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
