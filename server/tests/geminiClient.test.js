const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
  return {
    GoogleGenAI: jest.fn().mockImplementation(() => {
      return {
        models: {
          generateContent: mockGenerateContent
        }
      };
    }),
    Type: {
      ARRAY: 'ARRAY',
      OBJECT: 'OBJECT',
      STRING: 'STRING'
    }
  };
});

const { getAiSuggestions, getDietaryTagsForIngredient } = require('../utils/geminiClient');

describe('Gemini Client Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GEMINI_API_KEY = 'test_key_12345';
  });

  describe('getAiSuggestions', () => {
    it('should successfully compile a SWAP prompt and return parsed suggestions', async () => {
      const mockResponsePayload = [
        { ingredientName: 'Turkey Breast', reasonForRecommendation: 'Leaner protein.' },
        { ingredientName: 'Tofu', reasonForRecommendation: 'Plant-based alternative.' },
        { ingredientName: 'Egg Whites', reasonForRecommendation: 'Pure protein.' }
      ];

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockResponsePayload)
      });

      const context = {
        failureType: 'SWAP',
        failureReason: 'Over fat limit',
        offendingIngredient: 'Salami',
        targetMacro: 'protein',
        dietaryRestrictions: ['Gluten-Free'],
        currentIngredients: ['Salami', 'Cheddar'],
        zeroTargets: []
      };

      const result = await getAiSuggestions(context);

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result).toHaveLength(3);
      expect(result[0].ingredientName).toBe('Turkey Breast');

      const promptArgument = mockGenerateContent.mock.calls[0][0].contents;
      expect(promptArgument).toContain('Gluten-Free');
      expect(promptArgument).toContain('Salami');
      expect(promptArgument).toContain('SWAP OUT');
    });

    it('should successfully compile an ADD prompt with zero targets and return suggestions', async () => {
      const mockResponsePayload = [
        { ingredientName: 'Brown Rice', reasonForRecommendation: 'Source of complex carbs.' }
      ];

      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(mockResponsePayload)
      });

      const context = {
        failureType: 'ADD',
        failureReason: 'No carbs source',
        offendingIngredient: null,
        targetMacro: 'netCarbs',
        dietaryRestrictions: [],
        currentIngredients: ['Chicken Breast'],
        zeroTargets: ['fat']
      };

      const result = await getAiSuggestions(context);

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result).toBeDefined();

      const promptArgument = mockGenerateContent.mock.calls[0][0].contents;
      expect(promptArgument).toContain('ADD');
      expect(promptArgument).toContain('target of 0 grams of the following macronutrients: [fat]');
    });

    it('should throw a wrapped error when the generative model fails', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Quota exceeded'));

      const context = {
        failureType: 'ADD',
        failureReason: 'Failed target',
        currentIngredients: []
      };

      await expect(getAiSuggestions(context)).rejects.toThrow(
        'Failed to generate AI culinary suggestions.'
      );
    });
  });

  describe('getDietaryTagsForIngredient', () => {
    it('should return parsed tags when the AI returns a valid JSON array', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify(['Vegan', 'Dairy-Free', 'Gluten-Free'])
      });

      const result = await getDietaryTagsForIngredient('Broccoli');

      expect(mockGenerateContent).toHaveBeenCalled();
      expect(result).toEqual(['Vegan', 'Dairy-Free', 'Gluten-Free']);
    });

    it('should return an empty array if the model returns a non-array JSON structure', async () => {
      mockGenerateContent.mockResolvedValue({
        text: JSON.stringify({ isVegan: true })
      });

      const result = await getDietaryTagsForIngredient('Water');

      expect(result).toEqual([]);
    });

    it('should catch errors and safely return an empty array', async () => {
      mockGenerateContent.mockRejectedValue(new Error('Internal model error'));

      const result = await getDietaryTagsForIngredient('Olive Oil');

      expect(result).toEqual([]);
    });
  });
});
