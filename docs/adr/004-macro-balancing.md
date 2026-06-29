**Title:** Multi-Phase Gating and Proportional Scaling for Automated Recipe Macro Balancing

**Status:** Proposed

**Context:** The application features an automated recipe balancing algorithm designed to scale ingredients so a recipe fits a user's exact per-meal macronutrient targets. Early iterations of this algorithm relying purely on weight-based or calorie-based heuristics failed due to the "Density Disconnect." Highly calorically dense micro-ingredients (like olive oil or butter) were either incorrectly classified as negligible "seasonings" by weight, or they violently skewed the fat macros when scaled. This resulted in mathematically impossible scaling constraints (e.g., the algorithm requiring "negative" amounts of chicken to balance the fat from the oil) and destroyed the culinary viability and flavor profile of the dish.

**Decision:** Implement a three-phase macro balancing algorithm utilizing a strict "Multi-Factor Gate" to isolate dense ingredients from true seasonings before mathematical scaling occurs.

1. **Phase 1: Classification (The Multi-Factor Gate):** Every ingredient is analyzed to determine if it should be scaled for macros, or locked for flavor. An ingredient is safely classified as a "seasoning" ONLY IF it meets one of the following criteria:
   - It possesses the Semantic Category of `Spices & Herbs`.
   - OR it passes a strict baseline threshold test: `< 3% of total recipe calories` AND `< 1.5g Fat` AND `< 3g Carbs`.
2. **Phase 2: Grouping:** Any ingredient failing the Phase 1 gate is forced into active macro-calculation matrices based on its dominant macronutrient profile (e.g., `primary_protein_group`, `primary_fat_group`, `primary_carb_group`).
3. **Phase 3: Proportional Scaling:** The algorithm calculates the delta between the recipe's base macros and the user's target macros. It applies proportional linear algebra to scale the ingredients within their respective dominant groups to bridge the gap. Ingredients classified as "seasonings" in Phase 1 are locked to their original physical weights or scaled directly relative to the total mass to preserve the flavor profile.

**Consequences:**

- Mathematically prevents "negative macro" calculation errors by correctly identifying and grouping dense fat and carbohydrate sources prior to scaling.
- Protects the culinary viability of the recipe by preventing excessive scaling of minor but dense ingredients.
- Introduces increased computational complexity on the backend server during the classification and grouping phases.
- Requires strict data integrity for the ingredient database; the algorithm's success relies heavily on accurate semantic tagging (e.g., `Spices & Herbs`) and highly precise per-ingredient macro data.
