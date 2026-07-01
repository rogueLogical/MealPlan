const request = require('supertest');
const app = require('../server');
const { solveMatrix } = require('../utils/macroBalancer');
const { getAiSuggestions } = require('../utils/geminiClient');
const { fetchUsdaMacros } = require('../utils/usdaClient');
const Ingredient = require('../models/Ingredient');

jest.mock('../utils/macroBalancer');
jest.mock('../utils/geminiClient');
jest.mock('../utils/usdaClient');
jest.mock('../middleware/auth', () => {
  return (req, res, next) => {
    req.user = { id: 'test_mock_user_id' }; // Simulates a logged-in user
    next();
  };
});
jest.mock('../models/Ingredient', () => {
  // Mock the constructor used for "EDGE CASE: USDA found nothing"
  const MockIngredient = function (data) {
    Object.assign(this, data);
    this._id = 'mock_instantiated_id';
    this.toObject = function () {
      return this;
    }; // Controller relies on this
  };

  // Mock the static methods used for standard database lookups
  MockIngredient.findOne = jest.fn();
  MockIngredient.create = jest.fn();

  return MockIngredient;
});

describe('POST /api/recipes/balance', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: Simulate the ingredient NOT being found in the local DB
    // This forces the controller to fall back to your mocked USDA/Gemini clients
    Ingredient.findOne.mockResolvedValue(null);

    // Default: Simulate successfully saving a new ingredient to the DB
    Ingredient.create.mockImplementation(async (data) => ({
      ...data,
      _id: 'mock_created_id',
      toObject: function () {
        return this;
      }
    }));
  });

  const basePayload = {
    ingredients: [
      { name: 'Salami', weight: 50, protein: 10, fat: 15, netCarbs: 1 },
      { name: 'Provolone', weight: 40, protein: 12, fat: 10, netCarbs: 2 }
    ],
    targets: { protein: 45, fat: 20, netCarbs: 5 },
    dietaryRestrictions: [],
    interventionCount: 0
  };

  it('State 1: Should return "success" when the LP solver balances within the +/- 10% tolerance band', async () => {
    // Mock the solver to return a successful calculation.
    // Notice the totals don't have to be perfectly 45/20/5, just within 10%.
    solveMatrix.mockResolvedValue({
      isFeasible: true,
      scaledIngredients: [
        { name: 'Salami', weight: 80, protein: 16, fat: 24, netCarbs: 1.6 },
        { name: 'Provolone', weight: 85, protein: 25.5, fat: 21.25, netCarbs: 4.25 }
      ]
    });

    const response = await request(app).post('/api/recipes/balance').send(basePayload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.ingredients.length).toBe(2);

    // Assert that the matrix was attempted, but AI and USDA were not needed
    expect(solveMatrix).toHaveBeenCalledTimes(1);
    expect(getAiSuggestions).not.toHaveBeenCalled();
    expect(fetchUsdaMacros).not.toHaveBeenCalled();
  });

  it('State 2A: Should return a SWAP intervention when a specific ingredient causes a conflict', async () => {
    // Mock solver failing due to a specific ingredient (Condition 1 or 3)
    solveMatrix.mockResolvedValue({
      isFeasible: false,
      failureType: 'SWAP',
      offendingIngredient: 'Salami',
      failureReason: 'Coupled Variable Conflict: Fat limit exceeded.'
    });

    getAiSuggestions.mockResolvedValue([
      { ingredientName: 'Turkey Breast', reasonForRecommendation: 'High protein, low fat.' },
      { ingredientName: 'Chicken Breast', reasonForRecommendation: 'Lean protein.' },
      { ingredientName: 'Seitan', reasonForRecommendation: 'Plant-based lean protein.' }
    ]);

    fetchUsdaMacros.mockResolvedValue({ protein: 30, fat: 1, netCarbs: 0 });

    const response = await request(app).post('/api/recipes/balance').send(basePayload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('action_required');

    // Assert the new structured Intervention payload for a SWAP
    expect(response.body.intervention.type).toBe('SWAP');
    expect(response.body.intervention.targetIngredient).toBe('Salami');
    expect(response.body.intervention.options.length).toBe(3);
    expect(response.body.intervention.options[0].name).toBe('Turkey Breast');
  });

  it('State 2B: Should return an ADD intervention when the recipe lacks a macro entirely', async () => {
    // Mock solver failing because the Active Base for a macro is zero (Condition 2)
    solveMatrix.mockResolvedValue({
      isFeasible: false,
      failureType: 'ADD',
      targetMacro: 'netCarbs',
      failureReason: 'Zero Base Conflict: No viable source of netCarbs in current ingredients.'
    });

    getAiSuggestions.mockResolvedValue([
      {
        ingredientName: 'Brown Rice',
        reasonForRecommendation: 'Excellent source of complex carbs.'
      },
      { ingredientName: 'Sweet Potato', reasonForRecommendation: 'Nutrient-dense carbohydrate.' },
      { ingredientName: 'Quinoa', reasonForRecommendation: 'High protein carbohydrate.' }
    ]);

    fetchUsdaMacros.mockResolvedValue({ protein: 3, fat: 1, netCarbs: 20 });

    const response = await request(app).post('/api/recipes/balance').send(basePayload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('action_required');

    // Assert the new structured Intervention payload for an ADDITION
    expect(response.body.intervention.type).toBe('ADD');
    expect(response.body.intervention.targetIngredient).toBeNull(); // Nothing to replace
    expect(response.body.intervention.reasoning).toContain('netCarbs');
    expect(response.body.intervention.options.length).toBe(3);
    expect(response.body.intervention.options[0].name).toBe('Brown Rice');
  });

  it('State 3: Should return "approximate_success" (Circuit Breaker) when interventionCount >= 4', async () => {
    // Modify payload to trip the circuit breaker
    const trippedPayload = { ...basePayload, interventionCount: 4 };

    // Mock solver failing its strict 10% bounds, dropping constraints, and returning closest math
    solveMatrix.mockResolvedValue({
      isFeasible: false,
      isApproximate: true,
      scaledIngredients: [
        { name: 'Salami', weight: 60, protein: 12, fat: 18, netCarbs: 1.2 },
        { name: 'Provolone', weight: 50, protein: 15, fat: 12.5, netCarbs: 2.5 }
      ]
    });

    const response = await request(app).post('/api/recipes/balance').send(trippedPayload);

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('approximate_success');
    expect(response.body.ingredients.length).toBe(2);

    // Critical safety assertion: Ensure external API costs/calls are skipped when breaker trips
    expect(solveMatrix).toHaveBeenCalledTimes(1);
    expect(getAiSuggestions).not.toHaveBeenCalled();
    expect(fetchUsdaMacros).not.toHaveBeenCalled();
  });
});
