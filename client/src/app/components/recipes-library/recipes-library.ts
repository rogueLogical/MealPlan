import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IngredientSearch } from '../ingredient-search/ingredient-search';
import { Ingredient } from '../../services/ingredient';

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [CommonModule, IngredientSearch],
  templateUrl: './recipes-library.html',
  styleUrls: ['./recipes-library.scss'],
})
export class RecipesLibrary {
  showIngredientSearch = false;

  // TEMP quick handler to catch the emitted ingredient
  onIngredientSelected(ingredient: Ingredient): void {
    console.log('TEST SUCCESS: Received ingredient from modal:', ingredient);
    alert(`You selected: ${ingredient.name} (${ingredient.nutrition?.netCarbs}g Net Carbs)`);

    // Close the modal after selection
    this.showIngredientSearch = false;
  }
}
