Feature: 1.1.1. User Account Creation
  The system shall provide a way for users to create an 
  account.
  Scenario: Successful Account Creation (UAT-1)
    Given the user navigates to the register page
    When the user enters their correct new account data
    And the user clicks the create account button
    Then a toast message should appear saying that their account was created
    And the user is redirected to the login page

Feature: 1.1.2. User Authentication
  The system shall provide authentication services to 
  support user account log in. 
  Scenario: Successful Login (UAT-2)
    Given the user navigates to the login page
    When the user enters their valid username and password
    And the user clicks the log in button
    Then a toast message appears welcoming the user back to the site
    And the user is redirected to their home page
  Scenario: Successful Log out (UAT-3)
    Given a logged in user 
    When the user clicks the profile picture in the top right of the page header
    And the user clicks the log out button
    Then the user session token is deleted from browser memory
    And the user is redirected to the login page


Feature: 1.1.3. User Profile Management
  The system shall allow users to update their profile 
  information. 
  Scenario: Successful profile settings update (UAT-4)
    Given a logged in user navigates to the settings page
    When the user updates their avatar URL
    And the user updates their email address
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database

Feature: 1.1.4. User Interface Preferences
  The system shall allow users to set their preferences, 
  like selecting imperial or metric measurements. 
  Scenario: Successful interface settings update (UAT-5)
    Given a logged in user navigates to the settings page
    When the user updates their preferred measurement system
    And the user clicks the Save Settings button
    Then a toast message appears confirming settings were updated successfully
    And the user data is updated in the database


Feature: 1.1.5. User Account Recovery
  The system shall provide a solution for users to recover 
  their account access via email. 
  Scenario: Successful Account Recovery (UAT-6)
    Given the user navigates to the forgot-password page
    When the user enters their valid email address matching a registered account
    And the user clicks the Request Account Details button
    Then a toast message appears stating that if the account exists then an email has been sent
    And the system sends the user a recovery email including their username and a reset password link
  Scenario: Successful Password Reset Link (UAT-7)
    Given the user navigates to the reset-password page with a valid unexpired password reset link
    When the user enters matching passwords into the two password fields
    And the user clicks the Set Password button
    Then a toast message appears confirming the password was updated successfully
    And the user is redirected to the login page

Feature: 1.1.6. Email Verification
  The system shall verify new user email addresses upon 
  account creation. 

Feature: 1.1.7. User Account Deletion
  The system shall provide a way for users to delete 
  their account. 
