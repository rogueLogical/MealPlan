Feature: 1.10.1 Recipe Generation
  The system shall provide the ability for users to 
  generate recipes which meet their nutritional goals 
  and meal plan based on an AI text prompt. 
  Scenario: Recipe Generation (UAT-31)
    Given a logged in user has an idea for a recipe 
    When the user provides the system with a prompt describing the recipe they want to create. 
    Then the system uses AI semantics analysis and the ingredient database to generate a recipe based on the users input prompt, and the users nutritional goals. 
