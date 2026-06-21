import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IngredientService, Ingredient } from '../../services/ingredient';
import { AuthService } from '../../services/auth';
import { ToastService } from '../../services/toast';
import { NumbersOnlyDirective } from '../../directives/numbers-only';

@Component({
  selector: 'app-ingredient-form',
  standalone: true,
  imports: [CommonModule, FormsModule, NumbersOnlyDirective],
  templateUrl: './ingredient-form.html',
  styleUrls: ['./ingredient-form.scss'],
})
export class IngredientForm implements OnInit {
  @Input() ingredientId: string | null = null; // If null, we are in Create mode
  @Output() closeForm = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Ingredient>();

  currentUserId: string | undefined;
  isLoading = false;
  isEditMode = false;

  availableTags = [
    'Keto',
    'Low-Carb',
    'High-Protein',
    'High-Fat',
    'High-Fiber',
    'High-Carb',
    'Vegetarian',
    'Vegan',
    'Pescatarian',
    'Paleo',
    'Kosher',
    'Halal',
    'Gluten-Free',
    'Dairy-Free',
    'Nut-Free',
    'Shellfish-Free',
    'Soy-Free',
  ];

  formData: Ingredient = {
    name: '',
    servingSize: 100,
    servingUnit: 'g',
    nutritionPerServing: { protein: 0, totalCarbs: 0, fiber: 0, sugarAlcohols: 0, fat: 0 },
    tags: [],
  };

  private ingredientService = inject(IngredientService);
  private authService = inject(AuthService);
  private toastService = inject(ToastService);
  private cdr = inject(ChangeDetectorRef);

  ngOnInit(): void {
    this.authService.currentUser$.subscribe((user) => {
      this.currentUserId = user?.id;
      this.cdr.markForCheck();
    });

    if (this.ingredientId) {
      this.isEditMode = true;
      this.loadIngredient(this.ingredientId);
    }
  }

  loadIngredient(id: string): void {
    this.isLoading = true;
    this.ingredientService.getIngredientById(id).subscribe({
      next: (data) => {
        this.formData = data;
        this.isLoading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.toastService.showError('Failed to load ingredient data.');
        this.closeFormDialog();
      },
    });
  }

  // Real-time UI calculation for Net Carbs
  get uiNetCarbs(): number {
    const serving = this.formData.nutritionPerServing;
    const total = serving.totalCarbs || 0;
    const fiber = serving.fiber || 0;
    const sugarAlcohols = serving.sugarAlcohols || 0;
    const net = total - fiber - sugarAlcohols;
    return net > 0 ? Math.round(net * 10) / 10 : 0;
  }

  // Real-time UI calculation for Calories
  get uiCalories(): number {
    const serving = this.formData.nutritionPerServing;
    const protein = serving.protein || 0;
    const fat = serving.fat || 0;
    // Calculate raw total
    const totalCalories = protein * 4 + this.uiNetCarbs * 4 + fat * 9;
    // Round to 1 decimal place
    return Math.round(totalCalories * 10) / 10;
  }

  get isOwner(): boolean {
    return this.formData.createdBy === this.currentUserId;
  }

  toggleTag(tag: string, event: Event): void {
    const isChecked = (event.target as HTMLInputElement).checked;
    if (!this.formData.tags) this.formData.tags = [];

    if (isChecked) {
      this.formData.tags.push(tag);
    } else {
      this.formData.tags = this.formData.tags.filter((t) => t !== tag);
    }
  }

  hasTag(tag: string): boolean {
    return this.formData.tags?.includes(tag) || false;
  }

  onSubmit(): void {
    if (!this.formData.name.trim()) {
      this.toastService.showError('Ingredient name is required.');
      return;
    }

    const payload = { ...this.formData };

    if (this.isEditMode && this.ingredientId) {
      this.ingredientService.updateIngredient(this.ingredientId, payload).subscribe({
        next: (res) => {
          this.toastService.showSuccess(res.message);
          this.saved.emit(res.ingredient);
        },
        error: (err) => this.toastService.showError(err.error?.message || 'Update failed.'),
      });
    } else {
      this.ingredientService.createIngredient(payload).subscribe({
        next: (res) => {
          this.toastService.showSuccess(res.message);
          this.saved.emit(res.ingredient);
        },
        error: (err) => this.toastService.showError(err.error?.message || 'Creation failed.'),
      });
    }
  }

  onDelete(): void {
    if (
      !this.ingredientId ||
      !confirm('Are you sure you want to permanently delete this ingredient?')
    )
      return;

    this.ingredientService.deleteIngredient(this.ingredientId).subscribe({
      next: (res) => {
        this.toastService.showSuccess(res.message);
        this.closeForm.emit(); // Signal parent to refresh search list
      },
      error: (err) => this.toastService.showError(err.error?.message || 'Deletion failed.'),
    });
  }

  closeFormDialog(): void {
    this.closeForm.emit();
  }
}
