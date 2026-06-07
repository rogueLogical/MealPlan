const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  // Check for the absolute presence of the Authorization header at the beginning of processing
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: 'Authentication failed. Authorization header is missing.' });
  }

  try {
    // Safely parse the token string out of the Bearer schema format
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res
        .status(401)
        .json({ message: 'Authentication failed. Token format must be "Bearer <token>".' });
    }
    const token = parts[1];

    // Verify server environment configuration integrity
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('Error: JWT_SECRET environment variable is missing.');
      return res.status(500).json({ message: 'Internal server configuration error.' });
    }

    // Decode and verify the token signature
    let decodedToken;
    try {
      decodedToken = jwt.verify(token, jwtSecret);
    } catch (jwtError) {
      // Differentiates explicit token syntax/expiration validation faults cleanly
      console.log('Someone tried to log in with an invalid token: ', jwtError);
      return res
        .status(401)
        .json({ message: 'Authentication failed. Token is invalid or expired.' });
    }

    // Append the extracted credentials context safely onto the request
    req.userData = { userId: decodedToken.userId };

    return next();
  } catch (error) {
    console.error('Uncaught Exception inside Auth Middleware:', error);
    return res
      .status(500)
      .json({ message: 'An internal server error occurred during authentication processing.' });
  }
};
