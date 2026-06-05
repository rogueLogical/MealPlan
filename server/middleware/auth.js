const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 1. Grab the token out of the incoming HTTP header
    const token = req.headers.authorization.split(' ')[1];

    // 2. Decode and verify the token signature
    const jwtSecret = process.env.JWT_SECRET;
    //  if environment variable is not available, shutdown the backend server entirely
    //  this is for security purposes
    if (!jwtSecret) {
      console.error('Error: JWT_SECRET environment variable is missing.');
      process.exit(1);
    }
    const decodedToken = jwt.verify(token, jwtSecret);

    // 3. Append the extracted userId to the request object so subsequent routes know WHO is calling
    req.userData = { userId: decodedToken.userId };

    next(); // Pass control to the next endpoint route
  } catch (error) {
    return res.status(401).json({ message: 'Authentication failed. Token missing or invalid.' });
  }
};
