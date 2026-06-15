Feature: 1.2.1 Nutritional Goal Entry
  - The system shall provide a way for users to enter 
  their nutritional goals including daily calorie intake, 
  and a macronutrient breakdown (Protein, Fat, Carbs). 
  - The system shall allow users to update their nutritional 
  goals after initially setting them. 
  Scenario: Successful Nutritional Goal Entry (UAT-8)
    Given a logged in user navigates to the settings page
    When the user enters their macro settings
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database

  
Feature: 1.2.3. Dietary Restricitons
  The system shall provide a way for users to specify 
  their dietary restrictions. 
  Scenario: Successful Dietary Restriction Entry (UAT-9)
    Given a logged in user navigates to the settings page
    When the user toggles some dietary restrictions items
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database

Feature: 1.2.4. Dietary Preferences
  The system shall provide a way for users to specify 
  their dietary preferences, including favorite cuisines, 
  and disliked foods. 
  Scenario: Successful Dietary Preference Entry (UAT-10)
    Given a logged in user navigates to the settings page
    When the user enters their favorite foods and disliked foods
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database