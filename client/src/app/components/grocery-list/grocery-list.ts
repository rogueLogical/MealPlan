import { Component, OnInit, inject, ChangeDetectorRef, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MealPrepService, ShoppingListItem } from '../../services/meal-prep';
import { ToastService } from '../../services/toast';

@Component({
  selector: 'app-grocery-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './grocery-list.html',
  styleUrls: ['./grocery-list.scss'],
})
export class GroceryList implements OnInit {
  private prepService = inject(MealPrepService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  @ViewChild('nameInput') nameInput!: ElementRef<HTMLInputElement>;

  shoppingListId?: string;
  allItems: ShoppingListItem[] = [];
  isLoading = true;

  newItemName = '';
  newItemQty = 1;
  newItemUnit = 'pieces';

  draggedIndex: number | null = null;
  dragOverIndex: number | null = null;

  // Dialog confirmation state
  showClearConfirmDialog = false;

  ngOnInit(): void {
    this.loadList();
  }

  loadList(silent = false): void {
    if (!silent) {
      this.isLoading = true;
    }
    this.prepService.getShoppingList().subscribe({
      next: (res) => {
        this.shoppingListId = res.list._id;
        this.allItems = (res.list.items || []).sort(
          (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
        );
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastService.showError('Failed to load shopping list.');
        this.isLoading = false;
        this.cdr.markForCheck();
      },
    });
  }

  // Dialog Controls
  openClearConfirmDialog(): void {
    if (this.allItems.length === 0) return;
    this.showClearConfirmDialog = true;
    this.cdr.markForCheck();
  }

  closeClearConfirmDialog(): void {
    this.showClearConfirmDialog = false;
  }

  confirmClearList(): void {
    this.prepService.updateShoppingList([], this.shoppingListId).subscribe({
      next: () => {
        this.toastService.showSuccess('Shopping list cleared successfully.');
        this.allItems = [];
        this.closeClearConfirmDialog();
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Clear List Error:', err);
        this.toastService.showError('Failed to clear shopping list.');
        this.closeClearConfirmDialog();
        this.cdr.markForCheck();
      },
    });
  }

  get uncheckedItems(): ShoppingListItem[] {
    return this.allItems
      .filter((item) => !item.isChecked)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  get checkedItems(): ShoppingListItem[] {
    return this.allItems
      .filter((item) => item.isChecked)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  toggleItemCheck(item: ShoppingListItem, isChecked: boolean): void {
    if (!item._id) return;

    // Immediately synchronize local memory state
    item.isChecked = isChecked;

    this.prepService.toggleShoppingItem(item._id, isChecked).subscribe({
      next: (res) => {
        // Overwrite local list with the server's returned array to ensure absolute synchronization
        this.allItems = (res.list.items || []).sort(
          (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Toggle item check error', err);
        this.toastService.showError('Failed to update checked status.');
        item.isChecked = !isChecked; // Revert locally on failure
        this.cdr.markForCheck();
      },
    });
  }

  onDragStart(index: number): void {
    this.draggedIndex = index;
  }

  onDragOver(event: DragEvent, index: number): void {
    event.preventDefault();
    this.dragOverIndex = index;
  }

  onDragLeave(): void {
    this.dragOverIndex = null;
  }

  onDrop(index: number): void {
    if (this.draggedIndex === null || this.draggedIndex === index) {
      this.draggedIndex = null;
      this.dragOverIndex = null;
      return;
    }

    const list = this.uncheckedItems;
    const [draggedItem] = list.splice(this.draggedIndex, 1);
    list.splice(index, 0, draggedItem);

    // Reset drag indicators
    this.draggedIndex = null;
    this.dragOverIndex = null;

    // Recalculate unchecked index sequence
    list.forEach((item, idx) => {
      item.orderIndex = idx;
    });

    // Sync checked indices to follow the unchecked list sequence
    const checked = this.checkedItems;
    checked.forEach((item, idx) => {
      item.orderIndex = list.length + idx;
    });

    this.allItems = [...list, ...checked];

    this.prepService.updateShoppingList(this.allItems, this.shoppingListId).subscribe({
      next: (res) => {
        this.allItems = (res.list.items || []).sort(
          (a, b) => (a.orderIndex || 0) - (b.orderIndex || 0),
        );
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Failed to save order sequence', err);
        this.toastService.showError('Failed to persist custom ordering.');
      },
    });
  }

  addItem(): void {
    if (!this.newItemName.trim()) return;

    this.prepService.addManualItem(this.newItemName, this.newItemQty, this.newItemUnit).subscribe({
      next: () => {
        this.toastService.showSuccess(`Added "${this.newItemName}" to shopping list.`);
        this.newItemName = '';
        this.newItemQty = 1;
        this.newItemUnit = 'pieces';
        this.loadList(true);
        if (this.nameInput) {
          this.nameInput.nativeElement.focus();
        }
      },
      error: (err) => {
        console.error('Add Item Error', err);
        this.toastService.showError('Failed to add custom item.');
      },
    });
  }

  removeItem(item: ShoppingListItem): void {
    if (!item._id) return;

    this.prepService.removeShoppingItem(item._id).subscribe({
      next: () => {
        this.allItems = this.allItems.filter((i) => i._id !== item._id);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Remove Item Error', err);
        this.toastService.showError('Failed to remove item.');
      },
    });
  }
}
