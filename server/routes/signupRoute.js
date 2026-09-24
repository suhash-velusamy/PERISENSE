const express = require('express');
const Vendor = require('../models/vendorModel');
const Customer = require('../models/customerModel');

const router = express.Router();

// Public self-registration is intentionally Customer/Vendor only. Driver
// accounts are created by an authenticated Vendor (POST /api/vendor/drivers)
// so every Driver has exactly one owning Vendor from the moment it exists —
// see server/routes/vendorRoutes.js for that flow. A request that still
// sends role:'Driver' here (an old client build, or a direct API call) gets
// a clear rejection instead of silently creating an unowned account.
router.post('/signup', async (req, res) => {
  const {
    role,
    name,
    username,
    email,
    mobile,
    password,
    businessName,
    state,
    district
  } = req.body;

  if (role === 'Driver') {
    return res.status(403).json({
      message: 'Driver accounts cannot self-register. Ask your vendor to add you as a driver.',
    });
  }

  if (role !== 'Vendor' && role !== 'Customer') {
    return res.status(400).json({ message: 'Invalid role selected' });
  }

  if (!name || !username || !email || !mobile || !password) {
    return res.status(400).json({ message: 'name, username, email, mobile and password are required' });
  }
  if (role === 'Vendor' && !businessName) {
    return res.status(400).json({ message: 'businessName is required for Vendor registration' });
  }
  if (!state || !district) {
    return res.status(400).json({ message: 'state and district are required' });
  }

  const Model = role === 'Vendor' ? Vendor : Customer;

  try {
    // Friendly, specific duplicate checks up front. Mongo's unique index on
    // username/email would eventually reject a duplicate anyway, but only
    // via a raw E11000 — checking first lets us tell the user which field
    // collided instead of surfacing a generic/leaky error (see catch below).
    const [existingUsername, existingEmail] = await Promise.all([
      Model.findOne({ username }).select('_id'),
      Model.findOne({ email }).select('_id'),
    ]);
    if (existingUsername) {
      return res.status(409).json({ message: 'That username is already taken.' });
    }
    if (existingEmail) {
      return res.status(409).json({ message: 'An account with that email already exists.' });
    }

    const doc = new Model({
      name,
      username,
      email,
      mobileNo: mobile,
      password,
      state,
      district,
      ...(role === 'Vendor' && { businessName }),
    });
    await doc.save();
    return res.status(201).json({ message: `${role} registered successfully` });
  } catch (err) {
    // A duplicate key can still race past the check above under concurrent
    // requests — handle it without ever forwarding the raw driver/Mongo
    // error object to the client.
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ message: `That ${field} is already in use.` });
    }
    console.error('Signup error:', err.message);
    return res.status(500).json({ message: 'Error registering user' });
  }
});

module.exports = router;