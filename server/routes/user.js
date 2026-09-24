const express = require('express');
const router = express.Router();
const Vendor = require('../models/vendorModel');
const Customer = require('../models/customerModel');
const Driver = require('../models/driverModel');
const Notification = require('../models/notificationModel');

router.post('/token', async (req, res) => {
  const { userId, pushToken } = req.body;

  if (!userId || !pushToken) {
    return res.status(400).json({ error: 'Missing userId or pushToken' });
  }
  if (userId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. Not your account.' });
  }

  try {
    // Try to find the user in all three collections
    let user = await Vendor.findById(userId);
    if (!user) user = await Customer.findById(userId);
    if (!user) user = await Driver.findById(userId);

    if (!user) return res.status(404).json({ error: 'User not found' });

    user.expoPushToken = pushToken;
    await user.save();

    res.json({ success: true, message: 'Push token saved successfully' });
  } catch (err) {
    console.error('Error saving push token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/user/notifications
 * Notifications for the authenticated user, in their own role. Shared
 * across Vendor/Driver/Customer — recipientModel comes from the verified
 * JWT role, never a client-supplied value.
 */
router.get('/notifications', async (req, res) => {
  try {
    const notifications = await Notification.find({
      recipient: req.user.id,
      recipientModel: req.user.role,
    })
      .sort({ createdAt: -1 })
      .limit(100);

    res.json(notifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

/**
 * PUT /api/user/notifications/:id/read
 * Mark one notification as read (only the owning recipient may).
 */
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    if (notification.recipient.toString() !== req.user.id || notification.recipientModel !== req.user.role) {
      return res.status(403).json({ error: 'Access denied. Not your notification.' });
    }

    notification.read = true;
    await notification.save();

    res.json({ success: true, notification });
  } catch (err) {
    console.error('Error marking notification read:', err);
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

/**
 * PUT /api/user/notifications/read-all
 * Mark every notification for the authenticated user as read.
 */
router.put('/notifications/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, recipientModel: req.user.role, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error marking all notifications read:', err);
    res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;