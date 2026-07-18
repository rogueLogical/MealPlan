Feature: 1.6.1. Portion Storage Tracking
  The system shall provide users with the ability 
  to track how many portions of a recipe they have 
  in storage. 
  Prepared portions can be added by marking a planned recipe
  as completed, or from the recipe-detail view.
  Portion storage should have its own page on the site.
  Scenario: Adding new portions (UAT-25)
    Given a user has completed preparing a batch of one of their saved recipes. 
    When the user navigates to their saved recipe and inputs the number of newly prepared portions. 
    Then the system updates the number of stored portions for that recipe in the database. 
    And the interface accurately shows the number of portions of that recipe in the portion tracker. 

Feature: 1.6.2. Portion Consumption Tracking
  The system shall provide users with the ability 
  to record when they eat a portion, reducing the number
  of stored portions for that recipe.
  Scenario: Logging Consumed Portions (UAT-26)
    Given the user's storage tracker currently shows available portions for a stored recipe. 
    When the user records in the system that they have eaten a portion.
    Then the system dynamically deducts the consumed amount from the total and updates the remaining stored portions to reflect the recent consumption. 
