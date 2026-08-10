# Macro Balancer Engine

The **Macronutrient Balancer** automatically scales ingredient weights in a recipe so that a single portion hits your exact nutritional targets.

---

## How It Works

1. In the **Recipe Builder** under the ingredients list, click **⚖️ Balance Macros**.
2. The system executes a mathematic solver to scale active ingredients while preserving flavor structure and seasonings.

---

## Solver States & Interventions

- **Success**: The recipe balances mathematically within a `+/-10%` tolerance band. You can review the new ingredient weights and save.
- **Action Required (Intervention)**: If math alone cannot balance the recipe (e.g. missing a primary carb source), the AI suggests culinary fixes:
  - **ADD**: Recommends adding a new macro-dense ingredient.
  - **SWAP**: Recommends replacing a conflicting ingredient.
  - **REMOVE**: Prompts removal of an ingredient that conflicts with a `0g` target.
- **Approximate Match (Circuit Breaker)**: After 4 intervention attempts, the solver returns the closest mathematical approximation without altering the dish further. (You can save the results (or not), and edit the ingredients manually, then re-run the balancer to try again with a slightly different recipe.)
