import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { ElementRef } from '@angular/core';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { GroceryList } from './grocery-list';
import { MealPrepService, ShoppingList } from '../../services/meal-prep';
import { ToastService } from '../../services/toast';

describe('GroceryList Component In-Depth Coverage', () => {
  let component: GroceryList;
  let fixture: ComponentFixture<GroceryList>;

  // Declared as Partial<T> to strictly avoid using any any-type warnings
  let mockPrepService: Partial<MealPrepService>;
  let mockToastService: Partial<ToastService>;

  const mockShoppingList: ShoppingList = {
    _id: 'list_123',
    planId: 'plan_456',
    items: [
      { _id: 'item1', name: 'Broccoli', quantity: 200, unit: 'g', isChecked: false, orderIndex: 0 },
      { _id: 'item2', name: 'Apples', quantity: 3, unit: 'pieces', isChecked: true, orderIndex: 1 },
    ],
  };

  beforeEach(async () => {
    mockPrepService = {
      getShoppingList: vi.fn().mockReturnValue(of({ list: mockShoppingList })),
      updateShoppingList: vi
        .fn()
        .mockReturnValue(of({ message: 'Updated', list: mockShoppingList })),
      toggleShoppingItem: vi
        .fn()
        .mockReturnValue(of({ message: 'Toggled', list: mockShoppingList })),
      addManualItem: vi.fn().mockReturnValue(of({ message: 'Added', list: mockShoppingList })),
      removeShoppingItem: vi
        .fn()
        .mockReturnValue(of({ message: 'Removed', list: mockShoppingList })),
    };

    mockToastService = {
      showSuccess: vi.fn(),
      showError: vi.fn(),
      showInfo: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [GroceryList, FormsModule],
      providers: [
        { provide: MealPrepService, useValue: mockPrepService },
        { provide: ToastService, useValue: mockToastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GroceryList);
    component = fixture.componentInstance;
  });

  it('should load shopping list on init and separate checked vs unchecked items', () => {
    fixture.detectChanges(); // First change detection run (triggers ngOnInit)

    expect(component.isLoading).toBe(false);
    expect(component.shoppingListId).toBe('list_123');

    // Verify uncheckedItems computed getter
    const unchecked = component.uncheckedItems;
    expect(unchecked).toHaveLength(1);
    expect(unchecked[0].name).toBe('Broccoli');

    // Verify checkedItems computed getter
    const checked = component.checkedItems;
    expect(checked).toHaveLength(1);
    expect(checked[0].name).toBe('Apples');
    expect(mockPrepService.getShoppingList).toHaveBeenCalled();
  });

  it('should handle load list errors gracefully with error toast', () => {
    mockPrepService.getShoppingList = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));
    fixture.detectChanges();

    expect(component.isLoading).toBe(false);
    expect(mockToastService.showError).toHaveBeenCalledWith('Failed to load shopping list.');
  });

  it('should toggle item checked status and reload the list', () => {
    fixture.detectChanges();

    const itemToToggle = {
      _id: 'item1',
      name: 'Broccoli',
      quantity: 200,
      unit: 'g',
      isChecked: true,
    };
    component.toggleItemCheck(itemToToggle, true);

    expect(mockPrepService.toggleShoppingItem).toHaveBeenCalledWith('item1', true);
  });

  it('should handle check toggling errors gracefully and revert checked status locally', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.toggleShoppingItem = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));

    const itemToToggle = {
      _id: 'item1',
      name: 'Broccoli',
      quantity: 200,
      unit: 'g',
      isChecked: true,
    };
    component.toggleItemCheck(itemToToggle, true);

    expect(mockToastService.showError).toHaveBeenCalled();
    // Verify local status reverted on failure
    expect(itemToToggle.isChecked).toBe(false);
  });

  it('should add a custom manual item and refocus name input on success', () => {
    fixture.detectChanges();

    component.newItemName = 'Paper Plates';
    component.newItemQty = 10;
    component.newItemUnit = 'packs';

    // Mock native input element to verify focus call
    const mockInput = document.createElement('input');
    component.nameInput = new ElementRef(mockInput);
    const focusSpy = vi.spyOn(mockInput, 'focus');

    component.addItem();

    expect(mockPrepService.addManualItem).toHaveBeenCalledWith('Paper Plates', 10, 'packs');
    expect(mockToastService.showSuccess).toHaveBeenCalledWith(
      expect.stringContaining('Paper Plates'),
    );
    expect(component.newItemName).toBe(''); // Verify form cleared
    expect(focusSpy).toHaveBeenCalled(); // Verify focused back on name input
  });

  it('should handle manual item additions failures with error toast', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.addManualItem = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));

    component.newItemName = 'Napkins';
    component.addItem();

    expect(mockToastService.showError).toHaveBeenCalled();
  });

  it('should remove an item successfully and filter it locally from the array', () => {
    fixture.detectChanges();

    const itemToRemove = {
      _id: 'item1',
      name: 'Broccoli',
      quantity: 200,
      unit: 'g',
      isChecked: false,
    };
    component.removeItem(itemToRemove);

    expect(mockPrepService.removeShoppingItem).toHaveBeenCalledWith('item1');
    const found = component.allItems.find((i) => i._id === 'item1');
    expect(found).toBeUndefined(); // Verify removed locally
  });

  it('should handle item deletions failures with error toast', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.removeShoppingItem = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));

    const itemToRemove = {
      _id: 'item1',
      name: 'Broccoli',
      quantity: 200,
      unit: 'g',
      isChecked: false,
    };
    component.removeItem(itemToRemove);

    expect(mockToastService.showError).toHaveBeenCalled();
  });

  // Native HTML5 Drag and Drop Handlers
  it('should track and update native drag-and-drop state lifecycle events', () => {
    fixture.detectChanges();

    // 1. Drag Start
    component.onDragStart(3);
    expect(component.draggedIndex).toBe(3);

    // 2. Drag Over
    const mockEvent = { preventDefault: vi.fn() } as unknown as DragEvent;
    component.onDragOver(mockEvent, 2);
    expect(mockEvent.preventDefault).toHaveBeenCalled();
    expect(component.dragOverIndex).toBe(2);

    // 3. Drag Leave
    component.onDragLeave();
    expect(component.dragOverIndex).toBeNull();
  });

  it('should reorder items and save the updated index sequence on drop', () => {
    fixture.detectChanges();

    component.allItems = [
      { _id: 'item1', name: 'Broccoli', quantity: 200, unit: 'g', isChecked: false, orderIndex: 0 },
      {
        _id: 'item3',
        name: 'Bananas',
        quantity: 5,
        unit: 'pieces',
        isChecked: false,
        orderIndex: 1,
      },
      { _id: 'item2', name: 'Apples', quantity: 3, unit: 'pieces', isChecked: true, orderIndex: 2 }, // Checked at bottom
    ];

    mockPrepService.updateShoppingList = vi.fn().mockImplementation((items, id) => {
      return of({
        message: 'Updated',
        list: { _id: id, items },
      });
    });

    // Drag item 0 (Broccoli) and drop it at index 1 (below Bananas)
    component.draggedIndex = 0;
    component.onDrop(1);

    expect(component.draggedIndex).toBeNull();
    expect(component.dragOverIndex).toBeNull();

    // Verify reassigned orderIndex properties
    const bananas = component.allItems.find((i) => i._id === 'item3');
    const broccoli = component.allItems.find((i) => i._id === 'item1');
    expect(bananas?.orderIndex).toBe(0);
    expect(broccoli?.orderIndex).toBe(1);

    expect(mockPrepService.updateShoppingList).toHaveBeenCalledWith(component.allItems, 'list_123');
  });

  // Clear List Dialog Overlays
  it('should manage clearing confirmation modals and clear list', () => {
    fixture.detectChanges();

    component.openClearConfirmDialog();
    expect(component.showClearConfirmDialog).toBe(true);

    component.closeClearConfirmDialog();
    expect(component.showClearConfirmDialog).toBe(false);

    // Execute clear list
    component.openClearConfirmDialog();
    component.confirmClearList();

    expect(mockPrepService.updateShoppingList).toHaveBeenCalledWith([], 'list_123');
    expect(component.allItems).toHaveLength(0);
    expect(component.showClearConfirmDialog).toBe(false);
  });

  it('should handle clear list failures with error toast', () => {
    fixture.detectChanges();
    vi.spyOn(console, 'error').mockImplementation(() => {
      /* noop */
    });
    mockPrepService.updateShoppingList = vi
      .fn()
      .mockReturnValue(throwError(() => new Error('DB Error')));

    component.openClearConfirmDialog();
    component.confirmClearList();

    expect(mockToastService.showError).toHaveBeenCalled();
    expect(component.showClearConfirmDialog).toBe(false);
  });

  // HTML Template Render / DOM Testing
  it('should render loading text when isLoading is true', () => {
    vi.spyOn(component, 'loadList').mockImplementation(() => {
      /* noop */
    });
    component.isLoading = true;

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.loading-state')).toBeTruthy();
    expect(compiled.textContent).toContain('Loading your list');
  });

  it('should render empty state when allItems list has no entries', () => {
    mockPrepService.getShoppingList = vi
      .fn()
      .mockReturnValue(of({ list: { _id: 'list_123', items: [] } }));

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.empty-state')).toBeTruthy();
    expect(compiled.textContent).toContain('No Items in List');
  });
});
