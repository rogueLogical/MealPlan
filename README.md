# MealPlan

A Meal Preparation Planning and Execution platform for helping individuals meet their dietary goals.

## Development Setup (Local)

This project uses Docker Compose to spin up a local development environment, including a local instance of MongoDB. Code syncing (volumes) and hot-reloading when changes are saved are enabled by default.

### Prerequisites

- [Docker Desktop](https://docker.com) installed and running on the host machine.

### Spin Up the App

Run the following command from the repository's root directory:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

- **Frontend:** http://localhost:4200
- **Backend API:** http://localhost:3000
- **Local Database:** localhost:27017

### Bring Down the App

#### Stop the containers only

press `Ctrl +C` in the terminal where the logs are printing (if running in the foreground) to stop the containers.

#### Stop and clear data

Run the following command from the repository's root directory to stop the docker containers and completely clear the data:

```bash
docker-compose -f docker-compose.dev.yml down
```

### Production Notes

The `docker-compose.dev.yml` file is strictly for local testing and development.

In a production environment:

1. **Database:** Do not spin up the local `mongodb` container. Instead, provisioning an **Azure Cosmos DB** (API for MongoDB) instance is required.
2. **Environment Variables:** Provide the production Cosmos DB connection string via the `MONGO_URI` environment variable on the hosting provider.

## Code Quality & Static Analysis Tooling

This repository enforces strict code quality and formatting standards using **ESLint** and **Prettier**. These checks ensure a uniform coding style across the entire project and prevent syntax errors or accessibility gaps from reaching production.

### Tools Used

- **ESLint:** Analyzes code for code defects, unused variables, anti-patterns, and Angular template accessibility (v11y) rules.
- **Prettier:** Handles automatic code formatting (line widths, quoting styles, trailing commas, and semi-colons).
- **Husky & lint-staged:** Listens for git operations and automatically triggers code validation gates locally.

### Developer Workflow Commands

You can run static analysis checks manually from the root directory using the following scripts:

| Command                            | Action                                                                          |
| ---------------------------------- | ------------------------------------------------------------------------------- |
| `npm run format:check`             | Inspects all files and reports formatting discrepancies.                        |
| `npm run format:fix`               | Instantly overwrites and reformats all files to match project style guidelines. |
| `npx --prefix server npm run lint` | Runs ESLint syntax verification checks over the Node.js Express backend.        |
| `npx --prefix client npm run lint` | Runs Angular ESLint layout validation checks over the frontend client.          |

### Automated Pre-Commit Gates (Husky)

This project has an automated pre-commit hook powered by **Husky v10**.

Whenever you run `git commit`, the hook intercepts the task and uses `lint-staged` to inspect **only the files you modified**. It will:

1. Run Prettier to automatically auto-format your changes.
2. Run ESLint to check for unhandled code style or structural errors.

If a file contains an error that cannot be resolved automatically (like an unused variable or a missing accessibility attribute), **the commit will be rejected**. You must fix the issue reported in the terminal logs, then run `git add` before trying to commit your changes again.

### Recommended IDE Extensions

To streamline your workflow, it is highly recommended to install the following extensions in **VS Code** or **Code - OSS**:

- [ESLint](https://open-vsx.org/vscode/item?itemName=dbaeumer.vscode-eslint)
- [Prettier - Code formatter](https://open-vsx.org/vscode/item?itemName=esbenp.prettier-vscode)

Configure your IDE workspace settings to enable formatting automatically whenever you save a file:

```json
"editor.formatOnSave": true,
"editor.defaultFormatter": "esbenp.prettier-vscode"
```

## The Ingredient Database Pipeline

Our ingredient database is seeded using a custom, fault-tolerant, two-step pipeline that combines mathematical precision from the USDA with semantic intelligence from AI.

This solution generates the ingredient seed file located at `/server/data/ingredient_foundation_seed.json`. Which is then used when the server first boots up to pre-load the ingredients database table with the ingredients contained within. (You can add more ingredients to that manually if you want them to also be included in the initial database)

To completely rebuild the local database, run these scripts in order from within the /server directory:

### 1. The Mathematical Parser (`npm run seed:parse`)

This script (`server/scripts/parse_usda_csv.js`) streams the raw USDA Foundation Foods CSV files.

- **Data Integrity:** It aggressively purges any food that lacks a reliable real-world serving size.
- **Rule-Based Tagging:** It applies strictly calculated tags based on established nutritional science:
  - **Keto / Low-Carb:** Calculated directly from Net Carbs (Total Carbs - Fiber - Sugar Alcohols).
  - **High-Protein:** Uses a "Two-Key Lock" system (Must be $\ge$ 30% of total calories AND $\ge$ 10g of absolute protein per serving) to filter out low-density foods like broccoli.
  - **High-Fat:** $\ge$ 60% of total calories AND $\ge$ 15g per serving.
  - **High-Fiber:** $\ge$ 5g per serving (FDA standard).

### 2. The Semantic AI Tagger (`npm run seed:tag`)

This script (`server/scripts/tag_ingredients_ai.js`) reads the mathematically parsed output and uses the Gemini API to intelligently apply lifestyle and dietary tags (Vegan, Gluten-Free, Kosher, etc.).

- Processes ingredients in throttled batches of 50 to respect API rate limits.
- Forces strict JSON output and limits the AI to a predefined vocabulary matching the frontend application.
- Merges the semantic tags with the mathematical tags without duplication.
