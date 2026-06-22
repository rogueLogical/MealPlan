Feature: 1.4.1. Ingredient Search
  The system shall provide a searchable and filterable 
  database of ingredients for users to use in recipes. 

  Scenario: Paginated text search (UAT-12)
    Given a logged in user navigates to the ingredient search page
    When the user enters a query into the search bar and submits
    Then the system returns a paginated list of ingredients matching the text
    And the user can navigate between pages of results

  Scenario: Tag-based filtering (UAT-13)
    Given a logged in user navigates to the ingredient search page
    When the user selects one or more dietary tags (e.g., "Keto", "Dairy-Free")
    Then the system returns a paginated list of ingredients containing all the selected tags

Feature: 1.4.2. Ingredient Creation
  The system shall provide users with a way to create 
  their own ingredients and add them to the database 
  for use in their own recipes. 

  Scenario: Successful custom ingredient creation (UAT-14)
    Given a logged in user navigates to the create ingredient form
    When the user enters the ingredient name, nutrition facts data, and tags
    And the user inputs macros including total carbs, fiber, and sugar alcohols
    And the user clicks the Save Ingredient button
    Then the backend automatically calculates and stores the net carbs
    And the backend automatically calculates the 100g standard nutritional values
    And the database links the ingredient to the user's account ID
    And a toast message appears confirming the ingredient was created

  Scenario: Duplicate ingredient prevention (UAT-15)
    Given a logged in user navigates to the create ingredient form
    When the user enters an ingredient name that already exists in the database
    And the user clicks the Save Ingredient button
    Then the system rejects the submission
    And an error toast message appears stating the ingredient already exists

Feature: 1.4.3. Ingredient Storage & Modification
  The system shall store all relevant information 
  for each ingredient, including all nutrition facts.
  Users may only modify or delete ingredients they created.

  Scenario: Successful ingredient modification by creator (UAT-16)
    Given a logged in user is viewing the details of an ingredient they created
    When the user updates the macro values or tags
    And the user clicks the Update button
    Then the backend recalculates the net carbs
    And the database saves the updated ingredient data
    And a toast message appears confirming the update

  Scenario: Successful ingredient deletion by creator (UAT-17)
    Given a logged in user is viewing the details of an ingredient they created
    When the user clicks the Delete button and confirms the action
    Then the ingredient is removed from the database
    And the user is redirected back to the ingredient search page
    And a toast message appears confirming the deletion

  Scenario: Prevent modification of global/other user ingredients (UAT-18)
    Given a logged in user is viewing an ingredient created by the system or another user
    When the user attempts to modify the ingredient
    Then the interface hides or disables the Edit and Delete buttons
    And if the user attempts to send a direct PUT or DELETE API request, the system returns a 403 Forbidden error