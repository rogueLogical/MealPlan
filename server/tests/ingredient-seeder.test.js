const Ingredient = require('../models/Ingredient');

// Mock Mongoose model methods
jest.mock('../models/Ingredient');

// Mock seed JSON data locally
jest.mock(
  '../data/ingredient_foundation_seed.json',
  () => [
    { name: 'Seed Almonds', servingSize: 100 },
    { name: 'Seed Olive Oil', servingSize: 100 }
  ],
  { virtual: true }
);

const { seedIngredients } = require('../utils/ingredient-seeder');

describe('Ingredient Seeder Utility', () => {
  let saveMock;

  beforeEach(() => {
    jest.clearAllMocks();
    saveMock = jest.fn();

    // Mock Constructor instantiation
    Ingredient.mockImplementation(() => {
      return {
        save: saveMock
      };
    });
  });

  it('should skip seeding if database already has ingredients above the threshold', async () => {
    Ingredient.countDocuments.mockResolvedValue(100); // 100 > 50

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedIngredients();

    expect(Ingredient.countDocuments).toHaveBeenCalled();
    expect(saveMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping seed process'));

    logSpy.mockRestore();
  });

  it('should seed database ingredients successfully when count is below threshold', async () => {
    Ingredient.countDocuments.mockResolvedValue(10); // 10 < 50
    saveMock.mockResolvedValue(true);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedIngredients();

    expect(Ingredient.countDocuments).toHaveBeenCalled();
    expect(saveMock).toHaveBeenCalledTimes(2); // Mock seed contains 2 items
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully imported 2'));

    logSpy.mockRestore();
  });

  it('should handle duplicate key (11000) errors during save gracefully', async () => {
    Ingredient.countDocuments.mockResolvedValue(0);

    // First save fails as duplicate, second succeeds
    saveMock.mockRejectedValueOnce({ code: 11000 }).mockResolvedValueOnce(true);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    await seedIngredients();

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping "Seed Almonds"'));
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Successfully imported 1'));

    logSpy.mockRestore();
  });

  it('should catch generic save validation errors and proceed to seed the remaining items', async () => {
    Ingredient.countDocuments.mockResolvedValue(0);
    saveMock.mockRejectedValueOnce(new Error('Validation failed')).mockResolvedValueOnce(true);

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await seedIngredients();

    expect(saveMock).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error saving "Seed Almonds"'),
      'Validation failed'
    );

    errorSpy.mockRestore();
  });

  it('should catch critical database connection errors inside the outer catch block', async () => {
    Ingredient.countDocuments.mockRejectedValue(new Error('Database disconnected'));

    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await seedIngredients();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('Fatal error during ingredient initialization'),
      expect.any(Error)
    );

    errorSpy.mockRestore();
  });
});
