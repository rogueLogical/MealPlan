# MealPlan

A Meal Preparation Planning and Execution platform for helping individuals meet their dietary goals.

## Development Setup (Local)

This project uses Docker Compose to spin up a local development environment, including the Angular client, Node.js/Express server, and a local instance of MongoDB. Code syncing (volumes) and hot-reloading when changes are saved are enabled by default.

### Prerequisites

- [Docker Desktop](https://docker.com) installed and running on the host machine.
- [Node.js v20+](https://nodejs.org) and `npm` (required for running local linting, Prettier code formatting, and unit tests).

### Environment Variables Configuration

Before spinning up the application, you must configure your local environment variables so the backend can communicate with external APIs.

1. Navigate to the `/server` directory.
2. Create a new file named `.env`.
3. Add your API keys to the file:

```sh
# External Integrations
USDA_API_KEY=your_usda_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```

> **Note:** Free API keys can be obtained from [Data.gov](https://api.data.gov/signup/) (USDA) and [Google AI Studio](https://aistudio.google.com/) (Gemini). Never commit your `.env` file to version control.

### Spin Up the App

Run the following command from the repository's root directory:

```bash
docker-compose -f docker-compose.dev.yml up --build
```

- **Frontend Client:** http://localhost:4200
- **Backend API:** http://localhost:3000/api
- **Local Database:** localhost:27017

#### Automatic Database Seeding

On the initial container boot, the server automatically populates the local MongoDB instance with baseline USDA ingredients from `/server/data/ingredient_foundation_seed.json`.

#### Email Verification in Local Development

When running locally without production SMTP credentials configured, the backend automatically routes outgoing emails (such as registration verifications and password resets) through an **Ethereal Email Sandbox**.

1. When you register a new account on `http://localhost:4200`, the server prints an Ethereal preview link to your terminal logs (e.g., `Preview URL: https://ethereal.email/message/...`).
2. Open that URL in your browser to view the sandbox email inbox.
3. Click the **Verify Email** link in the message to activate your account and proceed to log in.

### Bring Down the App

#### Stop the containers only

Press `Ctrl + C` in the terminal where the container logs are running.

#### Stop and clear data

To stop the containers and completely reset the local database data:

```bash
docker-compose -f docker-compose.dev.yml down
```

> **Note:** The `docker-compose.dev.yml` file is strictly for local testing and development.

## Production Setup (Cloud Hosted)

If forking the repository, you will also need to update the GitHub workflows in `/.github/workflows/` to deploy to your own cloud instances and configure the appropriate deployment tokens/secrets in your GitHub repository settings.

### External Services Setup

#### Google Gemini API

Set up a project in [Google AI Studio](https://aistudio.google.com/) (you can use the free tier) and generate an API key for use during server setup.

#### USDA Nutritional Database API

Sign up at [Data.gov](https://api.data.gov/signup/) to create a free API key that the site uses to retrieve official nutrition information for ingredients.

#### SMTP Service (Email)

Set up an SMTP email service to support user verification and account recovery emails. You can use a free Gmail account for this by enabling 2-Factor Authentication and generating an **App Password**. Make note of the SMTP environment variables listed in the server configuration table below.

### Database Setup

Any cloud database provider (such as Azure Cosmos DB for MongoDB or MongoDB Atlas) can be used as long as it provides MongoDB API compatibility.

1. Provision a database cluster or instance.
2. Set up a database user and password.
3. Obtain the connection string (`MONGO_URI`), ensuring it includes your database credentials.

### Client Setup (Static Web App)

Deploy the `/client` directory to a cloud web provider capable of hosting static single-page applications (such as Azure Static Web Apps, Netlify, Vercel, or AWS S3/CloudFront).

- **SPA Routing:** Ensure your provider is configured with fallback/rewrite rules to route all non-asset requests to `index.html` (for example, using `staticwebapp.config.json` on Azure) so direct URL navigation works properly.
- Note down the deployed application's base URL (`CLIENT_URL`) for use in the server configuration.

### Server Setup (Web App)

Deploy the `/server` directory to a web application hosting service (such as Azure App Service, AWS Elastic Beanstalk, Render, or Railway). Configure the following environment variables in your hosting provider's management dashboard:

#### Environment Variables

| Name             | Description                                                                                                                           | Example Value                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `CLIENT_URL`     | Base URL of the deployed client web app (used for email verification and password reset links).                                       | `https://client-name.azurestaticapps.net`                                            |
| `GEMINI_API_KEY` | API Key for connecting to Google Gemini, obtained from [Google AI Studio](https://aistudio.google.com/).                              | `m029j09u0329md09ufj09309jd0j09`                                                     |
| `JWT_SECRET`     | Secret key used to sign and verify JSON Web Tokens (JWT) for user authentication sessions.                                            | `My_secret_value_12345`                                                              |
| `MONGO_URI`      | Connection string used by Mongoose to connect to the cloud-hosted MongoDB instance (must include username and password).              | `mongodb+srv://DBUser:DBPassword@cloudhosteddb.global.mongocluster.cosmos.azure.com` |
| `PORT`           | Port for the backend Express server to listen on. (Many cloud hosts inject this automatically; default fallback is `3000` or `8080`). | `8080`                                                                               |
| `SMTP_HOST`      | Host URL for the SMTP email server.                                                                                                   | `smtp.gmail.com`                                                                     |
| `SMTP_PASS`      | Password or App Password for connecting to the SMTP email service.                                                                    | `1234 1234 5678 5678`                                                                |
| `SMTP_PORT`      | Port number for connecting to the SMTP service (typically `465` for SSL or `587` for TLS).                                            | `465`                                                                                |
| `SMTP_SECURE`    | Set to `true` when connecting over port 465 (SSL), or `false` for port 587 (TLS).                                                     | `true`                                                                               |
| `SMTP_SERVICE`   | Name of the email service provider.                                                                                                   | `gmail`                                                                              |
| `SMTP_USER`      | Username or email address for connecting to the SMTP server.                                                                          | `email@gmail.com`                                                                    |
| `USDA_API_KEY`   | API Key generated from [Data.gov](https://api.data.gov/signup/).                                                                      | `fj020d9j092jdoidsj04t0ij09`                                                         |

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

## Testing

This project maintains test coverage to ensure application stability, utilizing modern testing frameworks tailored to both the frontend and backend architectures.

### Backend (Node.js/Express)

The backend API utilizes **Jest** and **Supertest** for isolated database unit testing and route integration testing.

- Run backend tests: `npx --prefix server npm run test`

### Frontend (Angular)

The client utilizes **Vitest** for blazing-fast, Vite-native component testing, isolating UI logic from injected services via strict mock boundaries.

- Run frontend tests: `npx --prefix client npm run test`

## Documentation & Architecture

Comprehensive documentation regarding the system architecture and API contracts is maintained within the repository.

- **Requirements Documentation** (and UAT specifications) are located in the `/docs/features/` directory.
- **API Documentation:** View the complete endpoint specifications, payload requirements, and authorization rules in [/docs/api/endpoints.md](/docs/api/endpoints.md).
- **Architecture Decision Records (ADRs):** Major architectural choices—such as our Soft-Delete data retention model, Centralized Reactive Auth State, and the Multi-Phase Macro Balancing Algorithm—are documented in the `/docs/adr/` directory. Review these records to understand the context and reasoning behind the codebase structure.
- **User Guide** A comprehensive guide for users of the MealPlan site is also maintained in the repository under the `/docs/user-guide/` directory, and is hosted online using mkdocs [here](https://roguelogical.github.io/MealPlan/).

The intention of storing all of this documentation here is to keep them all up to date alongside the source code as new features are developed and changes are made.

## The Ingredient Database Pipeline

Our ingredient database is seeded using a custom, fault-tolerant, two-step pipeline that combines mathematical precision from the USDA with semantic intelligence from AI.

This solution generates the ingredient seed file located at `/server/data/ingredient_foundation_seed.json`. Which is then used when the server first boots up to pre-load the ingredients database table with the ingredients contained within. (You can add more ingredients to that manually if you want them to also be included in the initial database)

To completely rebuild the local database, run these scripts in order from within the `/server` directory:

### 1. The Mathematical Parser (`npm run seed:parse`)

This script (`server/scripts/parse_usda_csv.js`) streams the raw USDA Foundation Foods CSV files.

- **Data Integrity:** It aggressively purges any food that lacks a reliable real-world serving size.
- **Rule-Based Tagging:** It applies strictly calculated tags based on established nutritional science:
  - **Keto / Low-Carb:** Calculated directly from Net Carbs (Total Carbs - Fiber - Sugar Alcohols).
  - **High-Protein:** Uses a "Two-Key Lock" system (Must be ≥ 30% of total calories AND ≥ 10g of absolute protein per serving) to filter out low-density foods like broccoli.
  - **High-Fat:** ≥ 60% of total calories AND ≥ 15g per serving.
  - **High-Fiber:** ≥ 5g per serving (FDA standard).

### 2. The Semantic AI Tagger (`npm run seed:tag`)

This script (`server/scripts/tag_ingredients_ai.js`) reads the mathematically parsed output and uses the Gemini API to intelligently apply lifestyle and dietary tags (Vegan, Gluten-Free, Kosher, etc.).

- Processes ingredients in throttled batches of 50 to respect API rate limits.
- Forces strict JSON output and limits the AI to a predefined vocabulary matching the frontend application.
- Merges the semantic tags with the mathematical tags without duplication.
