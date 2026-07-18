const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { seedIngredients } = require('./utils/ingredient-seeder');
require('dotenv').config(); // Loads a local .env file if present

const app = express();

// Required Middleware
app.use(
  cors({
    origin: 'https://thankful-tree-0f242730f-29.eastus2.7.azurestaticapps.net',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-New-Token']
  })
); // Allows Angular frontend to talk to this API
app.use(express.json()); // Parses incoming JSON request bodies

// Database Connection
// Falls back to the local Docker MongoDB container if process.env.MONGO_URI is not set
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/meandb';

// Connect to the database (if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(mongoURI)
    .then(async () => {
      console.log('Database connected successfully');
      await seedIngredients();
    })
    .catch((err) => {
      console.error('Database connection error:', err);
      process.exit(1); // Stop the server if the database connection fails
    });
}

// Set up API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is running smoothly' });
});

// Add /routes files to the API here
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const ingredientRoutes = require('./routes/ingredients');
const recipeRoutes = require('./routes/recipes');
const mealPlanRoutes = require('./routes/mealPlans');
const shoppingListRoutes = require('./routes/shoppingList');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/meal-plans', mealPlanRoutes);
app.use('/api/shopping-list', shoppingListRoutes);

// Export the app for supertest
module.exports = app;

// Start the Server (if not in test mode)
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is operating on port ${PORT}`);
  });
}
