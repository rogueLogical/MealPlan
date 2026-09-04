const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Required Middleware
app.use(
  cors({
    origin: 'https://thankful-tree-0f242730f-29.eastus2.7.azurestaticapps.net',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-New-Token']
  })
);
app.use(express.json());

// Database Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/meandb';

if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(mongoURI)
    .then(async () => {
      console.log('Database connected successfully');

      // Register migrations via a dedicated module — not in server.js itself
      const registerMigrations = require('./scripts/registerMigrations');
      await registerMigrations();
    })
    .catch((err) => {
      console.error('Database connection error:', err);
      process.exit(1);
    });
}

// Set up API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is running smoothly' });
});

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

// Admin routes — mounted at /admin/*
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

module.exports = app;

if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server is operating on port ${PORT}`);
  });
}
