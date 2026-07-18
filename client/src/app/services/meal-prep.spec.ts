import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MealPrepService } from './meal-prep';
import { environment } from '../../environments/environment';

describe('MealPrepService API Mappings', () => {
  let service: MealPrepService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [MealPrepService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MealPrepService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should execute correct HTTP calls for portion and plan states', () => {
    // 1. Portion Storage
    service.adjustPortionStorage('rec123', 'Salami', 4).subscribe();
    const req1 = httpMock.expectOne(`${environment.apiUrl}/users/storage/adjust`);
    expect(req1.request.method).toBe('POST');
    expect(req1.request.body).toEqual({ recipeId: 'rec123', recipeTitle: 'Salami', delta: 4 });
    req1.flush({ message: 'Success' });

    // 2. Fetch All Plans
    service.getAllPlans().subscribe();
    const req2 = httpMock.expectOne(`${environment.apiUrl}/meal-plans`);
    expect(req2.request.method).toBe('GET');
    req2.flush({ plans: [] });

    // 3. Append ingredients to Shopping List
    service.appendPlanToShoppingList('plan789').subscribe();
    const req3 = httpMock.expectOne(`${environment.apiUrl}/shopping-list/append-plan`);
    expect(req3.request.method).toBe('POST');
    expect(req3.request.body).toEqual({ planId: 'plan789' });
    req3.flush({ message: 'Success' });
  });
});
