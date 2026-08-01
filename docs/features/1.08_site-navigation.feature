Feature: 1.8.1. Navigation Menu
  The system shall provide a navigation bar which provides 
  the ability to nagigate to any of the main pages of the 
  site with a single click.
  
  Scenario: Use Navigation Menu (UAT-42)
    Given a user is logged in to their account. 
    When the user clicks on the buttons in the navigation bar. 
    Then the client route is updated to the target page 
    And the target page content is displayed on screen 

Feature: 1.8.2. Welcome page
  The system shall direct new users to a welcome page, which
  details the purpose of the system and it's main feaure set.
  The welcome page shall direct new and returning users to 
  create an account or log in.

  Scenario: Welcome Page (UAT-35)
    Given no user account is logged into the site. 
    When the user navigates to any route other than /login, /forgot-password, or /register. 
    Then the client redirects the user to the /welcome page route. 
    And the welcome page displays content explaining the purpose of the site, and directing the user to log in or create an account. 

Feature: 1.8.3. Home Page
  The system shall provide logged in users with a home page 
  that contains the most important information stored on the
  site. This should include, active meal plan, shopping cart,
  and overall portion tracking statuses. As well as a list of 
  the user's favorite recipes, and their most recently viewed
  recipes.
  
  Scenario: Homepage Contents (UAT-37)
    Given a user has some items in their shopping list, and portion storage. And the user has an active meal prep plan, and the user has some favorite recipes. 
    When the user opens the Home page. 
    Then the site displays their favorite recipes, active meal prep plan, and a summary of their shopping list and portion tracking. 

  Feature: 1.8.3.1. New User Direct to Settings
    The system shall direct new users to the settings page to
    set up their dietary settings. This direction should appear
    on the home page for new users.
    
    Scenario: New User Direct to Settings (UAT-36)
      Given a new user account was just created. 
      When the user logs into their account for the first time. 
      Then the Home Page shows an information box at the top directing the user to set their custom user settings. 
