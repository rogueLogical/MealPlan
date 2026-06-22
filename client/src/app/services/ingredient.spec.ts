import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IngredientService, Ingredient, PaginatedResponse } from './ingredient';
import { environment } from '../../environments/environment';

describe('IngredientService', () => {
  let service: IngredientService;
  let httpMock: HttpTestingController;

  const mockIngredient: Ingredient = {
    _id: '123',
    name: 'Almond Flour',
    servingSize: 100,
    servingUnit: 'g',
    nutritionPerServing: {
      calories: 590,
      protein: 21,
      totalCarbs: 21,
      fiber: 12,
      sugarAlcohols: 0,
      netCarbs: 9,
      fat: 52,
    },
    tags: ['Keto'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [IngredientService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(IngredientService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Verify that no unmatched outstanding requests remain
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should search ingredients with correct query parameters and pagination', () => {
    const mockResponse: PaginatedResponse<Ingredient> = {
      data: [mockIngredient],
      meta: { totalItems: 1, currentPage: 2, itemsPerPage: 10, totalPages: 1 },
    };

    service.searchIngredients('almond', ['Keto', 'Nut'], 2, 10).subscribe((response) => {
      expect(response.data.length).toBe(1);
      expect(response.meta.currentPage).toBe(2);
    });

    const req = httpMock.expectOne((request) => {
      return (
        request.url === `${environment.apiUrl}/ingredients` &&
        request.params.get('q') === 'almond' &&
        request.params.get('tags') === 'Keto,Nut' &&
        request.params.get('page') === '2' &&
        request.params.get('limit') === '10'
      );
    });

    expect(req.request.method).toBe('GET');
    req.flush(mockResponse);
  });

  it('should fetch a single ingredient by ID', () => {
    service.getIngredientById('123').subscribe((ingredient) => {
      expect(ingredient.name).toEqual('Almond Flour');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/ingredients/123`);
    expect(req.request.method).toBe('GET');
    req.flush(mockIngredient);
  });

  it('should create an ingredient', () => {
    service.createIngredient(mockIngredient).subscribe((response) => {
      expect(response.message).toEqual('Success');
      expect(response.ingredient.name).toEqual('Almond Flour');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/ingredients`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(mockIngredient);
    req.flush({ message: 'Success', ingredient: mockIngredient });
  });

  it('should update an ingredient', () => {
    const updatePayload = { name: 'Super Almond Flour' };

    service.updateIngredient('123', updatePayload).subscribe((response) => {
      expect(response.message).toEqual('Updated');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/ingredients/123`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(updatePayload);
    req.flush({ message: 'Updated', ingredient: { ...mockIngredient, ...updatePayload } });
  });

  it('should delete an ingredient', () => {
    service.deleteIngredient('123').subscribe((response) => {
      expect(response.message).toEqual('Deleted');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/ingredients/123`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ message: 'Deleted' });
  });
});
