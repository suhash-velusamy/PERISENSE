const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Customer = require('../models/customerModel');
const Vendor = require('../models/vendorModel');
const Driver = require('../models/driverModel');

// POST /api/login
router.post('/login', async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  try {
    let Model;
    if (role === 'Customer') Model = Customer;
    else if (role === 'Vendor') Model = Vendor;
    else if (role === 'Driver') Model = Driver;
    else return res.status(400).json({ message: 'Invalid role' });

    const user = await Model.findOne({ username: username });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // bcrypt compare
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    // Ensure JWT_SECRET is set
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('JWT_SECRET environment variable is not set');
      return res.status(500).json({ message: 'Server configuration error' });
    }

    // Create JWT Token
    const token = jwt.sign(
      { id: user._id, username: user.username, role: role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Send token + user data
    res.status(200).json({ success: true, message: 'Login successful', user, token });

  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
