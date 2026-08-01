Feature: 1.9.1 Recipe Macronutrient Balancing
  The system shall use a combination of the users 
  nutritional goals and their meal plan settings 
  to make portion and ingredient recommendations 
  for each recipe. 

  Scenario: Guided macronutrient balancing process (UAT-27)
    Given the user has set their daily nutritional goal target macros for Protein, Fat, and Net Carbs per meal or snack. 
    And the user has added a recipe to their account.
    When the user activated the macronutrient balancing tool on that recipe. 
    Then the system guides the user through a series of steps to update the recipe to match their target macros for the selected meal type. 