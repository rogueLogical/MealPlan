# MealPlan
A Meal Preparation Planning and Execution platform for helping individuals meet their dietary goals.

## Development Setup (Local)
This project uses Docker Compose to spin up a local development environment, including a local instance of MongoDB. Code syncing (volumes) and hot-reloading when changes are saved are enabled by default.

### Prerequisites
* [Docker Desktop](https://docker.com) installed and running on the host machine.

### Spin Up the App
Run the following command from the repository's root directory:
```bash
docker-compose -f docker-compose.dev.yml up --build
```
* **Frontend:** http://localhost:4200
* **Backend API:** http://localhost:3000
* **Local Database:** localhost:27017

### Bring Down the App
#### Stop the containers only
press `Ctrl +C` in the terminal where the logs are printing (if running in the foreground) to stop the containers.

#### Stop and clear data
Run the following command from the repository's root directory to stop the docker containers and completely clear the data:
```bash
docker-compose -f docker-compose.dev.yml down
```

---

## Production Notes
The `docker-compose.dev.yml` file is strictly for local testing and development. 

In a production environment:
1. **Database:** Do not spin up the local `mongodb` container. Instead, provisioning an **Azure Cosmos DB** (API for MongoDB) instance is required.
2. **Environment Variables:** Provide the production Cosmos DB connection string via the `MONGO_URI` environment variable on the hosting provider.
