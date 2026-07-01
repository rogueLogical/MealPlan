# ADR 005: NNLS and Circuit-Broken AI Interventions for Recipe Balancing

**Date:** July 1, 2026  
**Status:** Accepted / Implemented

---

## 1. Context and Problem Statement

The application allows users to build recipes and automatically scale ingredient weights to hit strict macronutrient targets (Protein, Fat, Net Carbs, Calories).

We needed a mathematical engine that could gracefully handle impossible constraints, preserve the culinary structure of the recipe, and intelligently guide the user to fix the recipe when math alone wasn't enough.

## 2. Decision

We decided in favor of a **Non-Negative Least Squares (NNLS) matrix solver paired with Tikhonov Regularization**, backed by a state-machine-driven intervention system and AI integrations.

Specifically, the architecture now implements the following:

1. **NNLS Matrix Solver:** Shifts from strict constraint satisfaction to minimizing the sum of squared errors.
2. **Tikhonov Regularization:** Introduces a penalty term to the cost function to anchor the new ingredient weights as closely to the original recipe baseline as mathematically possible.
3. **Deterministic Failure Diagnosis:** When the matrix solver hits a hard mathematical limit, the backend diagnoses the specific conflict (e.g., a missing macro base, or a direct conflict like a `REMOVE` necessity).
4. **Structured Interventions (SWAP/ADD/REMOVE):** The backend returns an `action_required` state, prompting the frontend to enter an intervention flow.
5. **Generative AI Fallback:** The backend dynamically calls an LLM (Gemini) to provide culinarily appropriate ingredient substitutes or additions, complete with USDA database verification.
6. **Recursive Circuit Breaker:** The balancer allows recursive calls (up to 4 attempts) as the user applies AI interventions, preventing infinite loops and managing external API costs.

## 3. Technical Architecture

### 3.1 The Mathematical Model

The core algorithm solves the following regularized optimization problem:

$$\min_{x \ge 0} \|Ax - b\|_2^2 + \lambda \|x - x_0\|_2^2$$

- **$A$**: The macronutrient matrix of the current ingredients.
- **$x$**: The computed optimal weights (constrained to non-negative values).
- **$b$**: The target macronutrient profile provided by the user.
- **$x_0$**: The original ingredient weights (culinary baseline).
- **$\lambda$**: The regularization parameter tuning how strictly the solver adheres to the original recipe versus the macro targets.

### 3.2 State Machine Flow (Frontend & Backend)

The system operates as a distributed state machine:

- **`CONFIG`**: User sets dietary restrictions (e.g., Keto, Dairy-Free) and reviews current targets.
- **`LOADING`**: The backend processes the NNLS matrix.
- **`INTERVENTION`**: Triggered if the NNLS error margin exceeds a 10% tolerance. The UI presents AI-generated, USDA-verified `SWAP`, `ADD`, or `REMOVE` options. Selecting an option seamlessly patches the local UI state and recursively triggers the solver.
- **`REVIEW`**: Triggered upon absolute success, or when the Circuit Breaker trips (returning an `approximate_success` flag to indicate the closest mathematical limit).

### 3.3 Database & Mocking Strategy

The backend natively searches the local Mongoose database (`Ingredient` collection) for AI-suggested items to reduce external USDA API calls. During testing, the `Ingredient` model is heavily mocked to bypass Mongoose buffering timeouts and ensure rapid execution of the test suite in CI/CD environments.

## 4. Consequences

### Positive

- **Culinary Integrity:** Regularization ensures recipes remain edible by heavily penalizing extreme weight deviations.
- **Resilience:** The system no longer crashes on impossible constraints; it instead acts as a dietary coach, explaining _why_ the math failed and offering intelligent fixes.
- **UX Alignment:** The frontend elegantly handles the asynchronous, recursive nature of the balancer without losing form state or un-muting the UI typography.
- **Cost Control:** The hard limit of `interventionCount: 4` guarantees that a single malicious or confused user cannot trap the application in an infinite loop of costly LLM and USDA API requests.

### Negative / Risks

- **Mathematical Complexity:** NNLS algorithms are more computationally expensive than basic LP models, though still negligible for the scale of standard recipes (typically < 20 ingredients).
- **Asynchronous Coupling:** The frontend and backend are tightly coupled in their understanding of the `InterventionOption` schema. Changes to the database models (e.g., `ingredientName` to `name`) require strict orchestration across the stack and test suites.
- **Non-Deterministic Edge Cases:** While the matrix solver is deterministic, the AI fallback is not. We must rely on strict JSON-schema enforcement when prompting Gemini to ensure the backend parser does not fail.
