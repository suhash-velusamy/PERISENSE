const Customer = require('../models/customerModel');
const { createNotification } = require('../services/notificationService');

/**
 * Fan out a notification to every customer currently granted tracking
 * access on a shipment (shipment.getNotifiableCustomerIds() — the same
 * explicit-grant list canCustomerTrack checks). Used on start/complete so
 * a customer who can track a shipment also hears about its milestones.
 */
async function notifyEligibleCustomers(shipment, { type, title, message }) {
  const customerIds = shipment.getNotifiableCustomerIds();
  if (customerIds.length === 0) return;

  const customers = await Customer.find({ _id: { $in: customerIds } }).select('expoPushToken');

  await Promise.all(customers.map((customer) => createNotification({
    recipientId: customer._id,
    recipientModel: 'Customer',
    type,
    title,
    message,
    relatedEntityType: 'Shipment',
    relatedEntityId: shipment._id,
    recipientPushToken: customer.expoPushToken,
  })));
}

module.exports = notifyEligibleCustomers;
