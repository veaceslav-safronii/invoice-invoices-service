const axios = require('axios');

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth:3001';

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    const response = await axios.post(`${AUTH_SERVICE_URL}/auth/validate`, {}, {
      headers: { authorization: authHeader }
    });

    if (!response.data.valid) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = response.data.user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authenticate };
