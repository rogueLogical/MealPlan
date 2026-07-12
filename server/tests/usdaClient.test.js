process.env.USDA_API_KEY = 'test_usda_key_12345';

const { fetchUsdaMacros } = require('../utils/usdaClient');

global.fetch = jest.fn();

describe('USDA Client Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw an error immediately if the USDA_API_KEY is not defined', async () => {
    // Fix: Clear module cache and environment variables specifically for this isolation block
    jest.resetModules();
    delete process.env.USDA_API_KEY;
    const { fetchUsdaMacros: fetchMacrosWithNoKey } = require('../utils/usdaClient');

    await expect(fetchMacrosWithNoKey('Avocado')).rejects.toThrow('Missing USDA_API_KEY');

    // Restore environment variables
    process.env.USDA_API_KEY = 'test_usda_key_12345';
    jest.resetModules();
  });

  it('should return a zeroed fallback structure when the API response is not OK', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500
    });

    const result = await fetchUsdaMacros('Avocado');

    expect(result).toEqual({ protein: 0, fat: 0, totalCarbs: 0, fiber: 0, netCarbs: 0 });
  });

  it('should return a zeroed fallback structure when the search returns empty results', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        foods: []
      })
    });

    const result = await fetchUsdaMacros('Nonexistent Food');

    expect(result).toEqual({ protein: 0, fat: 0, netCarbs: 0 });
  });

  it('should correctly select the best matching item and calculate net carbs', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        foods: [
          {
            description: 'Avocado, raw',
            foodNutrients: [
              { nutrientId: 1003, value: 2.0 },
              { nutrientId: 1004, value: 14.66 },
              { nutrientId: 1005, value: 8.53 },
              { nutrientId: 1079, value: 6.7 }
            ]
          }
        ]
      })
    });

    const result = await fetchUsdaMacros('Avocado');

    expect(result.protein).toBe(2);
    expect(result.fat).toBe(14.66);
    expect(result.netCarbs).toBe(1.83);
  });

  it('should apply fat keywords safeguard and select Avocado Oil over whole Avocado', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        foods: [
          {
            description: 'Avocado, raw',
            foodNutrients: [
              { nutrientId: 1003, value: 2.0 },
              { nutrientId: 1004, value: 14.66 }
            ]
          },
          {
            description: 'Oil, avocado',
            foodNutrients: [
              { nutrientId: 1003, value: 0 },
              { nutrientId: 1004, value: 100.0 },
              { nutrientId: 1005, value: 0 },
              { nutrientId: 1079, value: 0 }
            ]
          }
        ]
      })
    });

    const result = await fetchUsdaMacros('Avocado Oil');

    expect(result.fat).toBe(100.0);
  });

  it('should apply whole food fallback safeguard and select whole Avocado over Avocado Oil', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({
        foods: [
          {
            description: 'Oil, avocado',
            foodNutrients: [
              { nutrientId: 1003, value: 0 },
              { nutrientId: 1004, value: 100.0 }
            ]
          },
          {
            description: 'Avocado, raw',
            foodNutrients: [
              { nutrientId: 1003, value: 2.0 },
              { nutrientId: 1004, value: 14.66 },
              { nutrientId: 1005, value: 8.53 },
              { nutrientId: 1079, value: 6.7 }
            ]
          }
        ]
      })
    });

    const result = await fetchUsdaMacros('Avocado');

    expect(result.fat).toBe(14.66);
  });

  it('should catch uncaught exceptions and throw a wrapped error', async () => {
    global.fetch.mockRejectedValue(new Error('Network disconnected'));

    await expect(fetchUsdaMacros('Olive Oil')).rejects.toThrow(
      'Failed to verify nutritional data for Olive Oil'
    );
  });
});
