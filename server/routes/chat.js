const express = require('express');
const router = express.Router();
const pusher = require('../utils/pusher');
const Message = require('../models/Message');
const Vendor = require('../models/vendorModel');
const Customer = require('../models/customerModel');
const Driver = require('../models/driverModel'); // Assuming you have a Driver model
const { createNotification } = require('../services/notificationService');
const { authorize } = require('../middleware/auth');

/**
 * Send push notification via Expo Push API
 */
async function sendPushNotification(expoPushToken, { title, body }) {
  if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
    return; // Skip invalid tokens
  }

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
      }),
    });
    const data = await response.json();
    console.log('Push notification sent:', data);
  } catch (err) {
    console.error('Push notification error:', err);
    // Don't throw - push notification failure shouldn't break the chat
  }
}

router.post('/pusher/auth', (req, res) => {
  const { socket_id, channel_name } = req.body;
  // Identity comes from the verified JWT (set by authMiddleware), never
  // from a client-supplied header — a client can no longer authenticate
  // as an arbitrary user by simply changing a header value.
  const userId = req.user.id;

  if (!channel_name || !channel_name.includes(userId)) {
    return res.status(403).send('Unauthorized');
  }

  const auth = pusher.authenticate(socket_id, channel_name);
  res.send(auth);
});

/* ---------------------------------------------------------
 * POST /chat/send
 *  – vendor ↔ customer   → body must contain customerId
 *  – vendor ↔ driver     → body must contain driverId
 * -------------------------------------------------------- */
router.post('/send', async (req, res) => {
  const { vendorId, customerId, driverId, content } = req.body;
  const senderId = req.user.id;

  // Validate
  if (!vendorId || !content || (!customerId && !driverId)) {
    return res.status(400).json({
      error: 'vendorId, content, and a targetId are required',
    });
  }

  // The authenticated sender must actually be a participant of this
  // conversation (either the vendor, or the customer/driver on the
  // other end) — prevents posting into someone else's chat thread.
  if (![vendorId, customerId, driverId].includes(senderId)) {
    return res.status(403).json({ error: 'Access denied. Not a participant of this conversation.' });
  }

  try {
    /* 1️⃣ Save the message */
    const msg = await Message.create({
      vendorId,
      customerId: customerId || undefined,
      driverId: driverId || undefined,
      content,
      senderId,
    });

    /* 2️⃣ Real-time update via Pusher */
    const targetId = customerId || driverId;
    const channel = `private-chat-${vendorId}-${targetId}`;
    pusher.trigger(channel, 'new-message', msg);

    /* 3️⃣ Push notification — goes to whichever participant did NOT send
     * this message. Previously this always pushed to targetId
     * (customerId || driverId), which is correct when the vendor sends
     * but wrong when the customer/driver sends: the push landed back on
     * the sender's own device instead of the vendor's (Stage 4 report,
     * Phase 12 fix). */
    const recipientIsVendor = senderId !== vendorId;
    const RecipientModel = recipientIsVendor ? Vendor : (customerId ? Customer : Driver);
    const recipientId = recipientIsVendor ? vendorId : targetId;
    const recipientUser = await RecipientModel.findById(recipientId).select('expoPushToken');

    if (recipientUser?.expoPushToken) {
      await sendPushNotification(recipientUser.expoPushToken, {
        title: 'New Message',
        body: content,
      });
    }

    /* 4️⃣ Persist a Notification for the same, correctly-computed
     * recipient. */
    await createNotification({
      recipientId: recipientIsVendor ? vendorId : targetId,
      recipientModel: recipientIsVendor ? 'Vendor' : (customerId ? 'Customer' : 'Driver'),
      type: 'CHAT_MESSAGE',
      title: 'New message',
      message: content.length > 100 ? `${content.slice(0, 97)}...` : content,
      relatedEntityType: 'Message',
      relatedEntityId: msg._id,
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error('Message save error:', err);
    res.status(500).json({ error: 'Could not send message' });
  }
});

/* ---------------------------------------------------------
 * GET /chat/history
 *  – expects vendorId, targetId, chatType = 'customer' | 'driver'
 * -------------------------------------------------------- */
router.get('/history', async (req, res) => {
  const { vendorId, targetId, chatType } = req.query;

  if (!vendorId || !targetId || !chatType) {
    return res.status(400).json({ error: 'vendorId, targetId, chatType are required' });
  }
  if (![vendorId, targetId].includes(req.user.id)) {
    return res.status(403).json({ error: 'Access denied. Not a participant of this conversation.' });
  }

  const filter = { vendorId };
  if (chatType === 'customer') filter.customerId = targetId;
  if (chatType === 'driver') filter.driverId = targetId;

  try {
    const history = await Message.find(filter).sort({ createdAt: 1 });
    res.json(history);
  } catch (err) {
    console.error('Chat history fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/vendors/get', async (req, res) => {
  try {
    const { q } = req.query;

    // Match all vendors or filter by name
    const filter = q
      ? { name: { $regex: new RegExp(q, 'i') } }   // i = case-insensitive
      : {};

    // Return only the fields you need in the list
    const vendors = await Vendor.find(filter)
      .select('name businessName _id')              // choose fields
      .sort({ name: 1 });

    res.json(vendors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});


// GET all customers for vendor chat list
// Vendor-only: this returns every customer's name + mobile number, so it
// must not be reachable by an authenticated Customer or Driver (chat.js is
// mounted with only authMiddleware in server.js since it's shared across
// roles, so the role gate has to live here rather than at the mount point).
router.get('/customers/get', authorize('Vendor'), async (req, res) => {
  try {
    const customers = await Customer.find({}, '_id name mobileNo').sort({ createdAt: -1 });
    res.json(customers);
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/vendor-drivers', async (req, res) => {
  const { vendorId } = req.query;
  if (!vendorId) {
    return res.status(400).json({ error: 'vendorId is required' });
  }
  if (vendorId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. Not your account.' });
  }

  try {
    const vendor = await Vendor.findById(vendorId).populate({
      path: 'drivers',
      select: '_id name mobileNo', // limit fields
    });

    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor.drivers);
  } catch (err) {
    console.error('Error fetching vendor drivers:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/vendors/by-driver', async (req, res) => {
  const { driverId } = req.query;

  if (!driverId) {
    return res.status(400).json({ error: 'driverId is required' });
  }
  if (driverId !== req.user.id) {
    return res.status(403).json({ error: 'Access denied. Not your account.' });
  }

  try {
    const vendors = await Vendor.find({ drivers: driverId })
      .select('_id name businessName mobileNo');

    res.json(vendors);
  } catch (err) {
    console.error('Error fetching vendors for driver:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;
