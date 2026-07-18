Feature: 1.7.1. Meal Prep Plan Creation
    The system shall provide a mechanism for users to plan meal 
    preparation activities, including selecting which recipes to 
    cook, and how many portions of each recipe to cook. 
    The number of portions selectable for each recipe should scale 
    in intervals matching the number of portions that the base 
    recipe was written for.
    Once a meal prep plan is created, the user should be able to 
    view and edit the plan.
    Scenario: Meal Prep Planning (UAT-28)
        Given the user wants to plan a meal prep activity, and has the recipes they want to prepare in the system. 
        When the user selects recipes and number of portions that they want to prepare for each one. 
        Then the system generates a planned recipe for each chosen recipe with the ingredients scaled to meet the planned number of portions for each recipe. The system also generates an editable shopping list for the user including all the needed ingredients for all the planned recipes. 

Feature: 1.7.2. Shopping List Generation
    The system shall add ingredients to a shopping list based on the 
    ingredients and number of portions of the selected recipes 
    when a meal prep plan is created. 
    If multiple recipes use the same ingredients, then the system should
    add their quanities together to form only one line per ingredient in
    the shopping list.
    If a user edits an existing meal plan, they should have the option to 
    update the shopping list with the changes.
    Scenario: Shopping List (UAT-29)
        Given the user has created a meal prep plan. 
        When the user views the meal prep plan. 
        Then the user is able to view and edit a shopping list associated with that meal prep plan. 

Feature: 1.7.3. Shopping List Editing
    The system shall allow users to modify the generated shopping 
    list by editing list items and adding and removing items. 
    Scenario: Rapidly adding a manual custom item to the shopping list using the Enter key (UAT-32)
        Given the user is on the "Shopping List" page
        And the cursor is focused inside the custom item name input field
        When the user types "Zip Bags"
        And the user enters "1" as the quantity and "pieces" as the unit
        And the user presses the "Enter" key
        Then the item "Zip Bags (1 pieces)" should be added to the needed items list
        And the cursor focus should automatically return to the item name input field to allow consecutive entries

Feature: 1.7.4. Shopping List Item Checking
    The system shall allow users to check off and un-check items from the 
    shopping list as they do their shopping.
    Scenario: Checking, unchecking, and custom drag-and-drop reordering of shopping list items (UAT-33)
        Given the user is on the "Shopping List" page
        And the unchecked section contains the items: "Zip Bags", "Broccoli (250g)", "Lemon (2 pieces)", and "Olive Oil"
        When the user drags "Olive Oil" to the very top of the unchecked list
        And the user checks the checkbox next to "Broccoli (250g)"
        Then the "Broccoli (250g)" item should move to the "Checked Off" section at the bottom of the page
        When the user unchecks the checkbox next to "Broccoli (250g)" in the checked section
        Then the "Broccoli (250g)" item should return to the unchecked section at its exact previous relative position (between "Olive Oil" and "Lemon")
        And all checkbox states and custom positions should remain fully preserved upon page refresh

Feature: 1.7.5. Planned Recipe Viewing
    The system shall provide the user with a planned recipe for 
    each recipe selected, the planned recipe version has its 
    ingredients already scaled up to match the number of portions
    in the Meal Prep Plan. 
    Scenario: Viewing scaled-up ingredient quantities inside a planned recipe (UAT-34)
        Given the user has an active meal prep plan
        And the plan contains "Seared Chicken" planned for 12 portions (where the base recipe yields 4 portions, requiring 150g broccoli)
        When the user clicks "View scaled Recipe" next to "Seared Chicken"
        Then a scaled recipe modal should open matching the styling and layout of your standard recipe details page
        And the "Macros Per Portion" section and all action buttons (edit, favorite, copy) should be omitted
        And the displayed quantity of broccoli should be scaled up to 450g

Feature: 1.7.6. Planned Recipe Completion
    The system shall provide a function to add planned meal 
    portions to the storage tracker when meal prep is completed. 
    Scenario: Cook Recipe (UAT-30)
        Given the user has created a meal prep plan. 
        When the user views the meal prep plan. 
        Then the user can view the planned recipes, and is able to mark them as completed, and optionally add the cooked portions to the portion tracker. 
