Feature: 1.3.1. & 1.3.2. User Meal Plan Management
  - The system shall provide users with a way to set 
  up a meal plan, including how many meals, and 
  how many snacks they want to eat each day. 
  - The system shall allow users to update their meal 
  plan after initially setting it. 
  Scenario: Successful Meal Plan Entry
    Given a logged in user navigates to the settings page
    When the user enters their number of meals and snacks
    And the user adjusts the Macro Split sliders
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database
