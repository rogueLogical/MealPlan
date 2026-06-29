Feature: 1.5.1. Recipe Storage
  The system shall provide the capability to store recipes 
  for cooking, including photos, description, ingredients, 
  instructions, minimum number of portions, and  
  Scenario: Storing Recipe Data (UAT-19)
    Given a logged-in user has entered the details for a recipe, including a brief description, a list of ingredients and measurements, preparation instructions, and set the minimum portions
    When the user saves the recipe
    Then the system successfully stores all provided data fields and displays the complete recipe profile

Feature: 1.5.2. Recipe Search
  The system shall maintain a searchable and filterable 
  database of recipes for users to browse. 
  Scenario: Recipe Database Search (UAT-20)
    Given the user is on the main recipe discovery page
    When the user enters text in the search bar and applies a dietary restriction filter
    Then the system returns a searchable, filtered list of matching recipes from the recipe database

Feature: 1.5.3. Recipe Creation
  The system shall provide logged in users with the 
  ability to create and save their own recipes. 
  Scenario: Successful Recipe Creation
    Given an authenticated user is on the recipe creation dashboard
    When the user fills out the required recipe fields and clicks "Create"
    Then the system saves the new recipe under the user's account and confirms the creation

Feature: 1.5.4. User Recipe Browsing
  The system shall provide logged in users with the 
  ability to view, search, and filter a list of their saved 
  recipes. 
  Scenario: Filtering Personal Recipe Library
    Given a logged-in user has navigated to their personal saved recipes library
    When the user loads the page
    Then the system displays a filtered list restricted only to the user's previously saved recipes

Feature: 1.5.5. Recipe Copying
  The system shall provide logged in users with the ability
  to copy existing recipes. 
  Scenario: Recipe Duplication
    Given a logged-in user is viewing a recipe created by another user
    When the user clicks the "Copy Recipe" button
    Then the system creates a duplicate copy of the recipe and adds it to the user's personal library

Feature: 1.5.6. Recipe Modification
  The system shall provide logged in users with the ability 
  to modify existing recipes. 
  Scenario: Editing a Saved Recipe
    Given a logged-in user is viewing one of their saved recipes
    When the user updates the recipe data fields
    And the user clicks "Save Recipe"
    Then the system updates the existing recipe in the database with the modifications