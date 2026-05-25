const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config(); // Loads a local .env file if present

const app = express();

// Required Middleware
app.use(cors()); // Allows Angular frontend to talk to this API
app.use(express.json()); // Parses incoming JSON request bodies

// Database Connection
// Falls back to the local Docker MongoDB container if process.env.MONGO_URI is not set
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/meandb';

mongoose.connect(mongoURI)
  .then(() => console.log('Database connected successfully'))
  .catch(err => {
    console.error('Database connection error:', err);
    process.exit(1); // Stop the server if the database connection fails
  });

// Set up API Routes
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP', message: 'Backend is running smoothly' });
});

// Add /routes files to the API here


// Start the Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is operating on port ${PORT}`);
});
