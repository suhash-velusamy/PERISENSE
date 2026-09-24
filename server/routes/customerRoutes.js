/**
 * Customer Routes - API endpoints for customer features
 */
const express = require('express');
const router = express.Router();
const Customer = require('../models/customerModel');
const Vendor = require('../models/vendorModel');
const Vehicle = require('../models/VehicleModel');
const Device = require('../models/deviceModel');
const Export = require('../models/shipmentModel');
const ShipmentEvent = require('../models/shipmentEventModel');
const { STATUSES } = require('../utils/shipmentStateMachine');
const rescueService = require('../services/rescueService');

// Event types a customer is allowed to see on a shipment timeline. The
// query below already .select()s only eventType + timestamp, so even
// DRIVER_REJECTED never leaks the rejection reason (metadata) or the
// driver's identity (actor/actorModel) — just that the step happened and
// when (Stage 8 Phase 7: customer must see the rejection branch of the
// timeline, not just the happy path).
const CUSTOMER_VISIBLE_EVENT_TYPES = [
  'SHIPMENT_CREATED',
  'DRIVER_ASSIGNED',
  'DRIVER_ACCEPTED',
  'DRIVER_REJECTED',
  'DELIVERY_STARTED',
  'DELIVERY_COMPLETED',
];

/**
 * GET /api/customer/profile/:customerId
 * Get customer profile
 */
router.get('/profile/:customerId', async (req, res) => {
    try {
        if (req.params.customerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your account.' });
        }
        const customer = await Customer.findById(req.params.customerId).select('-password');
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        res.json(customer);
    } catch (err) {
        console.error('Error fetching customer profile:', err);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});

/**
 * PUT /api/customer/location
 * Set/replace the authenticated customer's preferred delivery location.
 * Identity always comes from the JWT (req.user.id) — never a body/URL
 * customerId — so a customer can only ever update their own location.
 * Independent of Rescue Sale opt-in: PUT /rescue-preferences below also
 * writes these same `location`/`locationUpdatedAt` fields as a side effect
 * of that flow, but a customer may set a preferred location without opting
 * into Rescue Sale notifications, and vice versa.
 */
router.put('/location', async (req, res) => {
    try {
        const { latitude, longitude } = req.body;

        if (typeof latitude !== 'number' || typeof longitude !== 'number' ||
            !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return res.status(400).json({ error: 'latitude and longitude are required numbers' });
        }
        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({ error: 'latitude must be between -90 and 90' });
        }
        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({ error: 'longitude must be between -180 and 180' });
        }

        const customer = await Customer.findByIdAndUpdate(
            req.user.id,
            {
                location: { type: 'Point', coordinates: [longitude, latitude] },
                locationUpdatedAt: new Date(),
            },
            { new: true, runValidators: true }
        ).select('-password');

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        res.json({ success: true, location: customer.location, locationUpdatedAt: customer.locationUpdatedAt });
    } catch (err) {
        if (err.name === 'ValidationError') {
            return res.status(400).json({ error: 'Invalid coordinates' });
        }
        console.error('Error updating customer location:', err);
        res.status(500).json({ error: 'Failed to update location' });
    }
});

/**
 * GET /api/customer/vendors
 * Get list of all vendors
 */
router.get('/vendors', async (req, res) => {
    try {
        const vendors = await Vendor.find({})
            .select('name mobileNo state district')
            .sort({ name: 1 });
        res.json(vendors);
    } catch (err) {
        console.error('Error fetching vendors:', err);
        res.status(500).json({ error: 'Failed to fetch vendors' });
    }
});

/**
 * GET /api/customer/vendors/:vendorId
 * Get single vendor details
 */
router.get('/vendors/:vendorId', async (req, res) => {
    try {
        const vendor = await Vendor.findById(req.params.vendorId)
            .select('-password')
            .populate('drivers', 'name')
            .populate('vehicles', 'vehicleNumber brand');

        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        res.json(vendor);
    } catch (err) {
        console.error('Error fetching vendor:', err);
        res.status(500).json({ error: 'Failed to fetch vendor' });
    }
});

/**
 * GET /api/customer/exports/available
 * Get all active/available exports (Started status) that customer can track
 */
router.get('/exports/available', async (req, res) => {
    try {
        const { state, district } = req.query;

        // Browse Goods shows a shipment only when it has an active (PUBLISHED,
        // not-yet-expired) Rescue Sale posted against it — being IN_TRANSIT
        // alone is not enough. See rescueService.listActiveRescueShipmentIds.
        const activeRescueShipmentIds = await rescueService.listActiveRescueShipmentIds();

        let query = { status: STATUSES.IN_TRANSIT, _id: { $in: activeRescueShipmentIds } };

        // Filter by location if provided
        if (state || district) {
            query['routes'] = { $exists: true };
        }

        const exports = await Export.find(query)
            .populate('vendorId', 'name mobileNo')
            .populate('driver', 'name mobileNo')
            .populate('vehicle', 'vehicleNumber brand')
            .sort({ startDate: -1 })
            .limit(50);

        // Pricing/salary/instructions are vendor-operational, not
        // customer-facing (Stage 5 §7) — strip them from every shipment in
        // this browse list, not just the single-shipment track endpoint.
        res.json(exports.map((exp) => exp.toCustomerView()));
    } catch (err) {
        console.error('Error fetching available exports:', err);
        res.status(500).json({ error: 'Failed to fetch exports' });
    }
});

/**
 * GET /api/customer/my-shipments
 * Shipments this customer is associated with: named as the shipment's
 * primary customer, and/or granted tracking access. Unlike
 * /exports/available (a public browse-all list), this reflects "shipments
 * that are mine" regardless of status, and flags whether tracking is
 * currently allowed for each one so the UI doesn't have to guess before
 * the customer taps in.
 */
router.get('/my-shipments', async (req, res) => {
    try {
        const customerId = req.user.id;
        const exports = await Export.find({
            $or: [
                { customer: customerId },
                { 'trackingViewers.customer': customerId },
            ],
        })
            .populate('vendorId', 'name mobileNo')
            .populate('driver', 'name mobileNo')
            .populate('vehicle', 'vehicleNumber brand')
            .sort({ createdAt: -1 });

        const result = exports.map((exp) => ({
            ...exp.toCustomerView(),
            trackingAllowed: exp.canCustomerTrack(customerId),
        }));

        res.json(result);
    } catch (err) {
        console.error('Error fetching customer shipments:', err);
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

/**
 * GET /api/customer/track/:exportId
 * Get tracking info for an export
 */
router.get('/track/:exportId', async (req, res) => {
    try {
        const exportData = await Export.findById(req.params.exportId)
            .populate('vendorId', 'name mobileNo')
            .populate('driver', 'name mobileNo')
            .populate('vehicle', 'vehicleNumber brand');

        if (!exportData) {
            return res.status(404).json({ error: 'Export not found' });
        }

        // Explicit-grant tracking permission (Stage 5 §6 — overrides Stage
        // 4's temporary default-open behavior). See
        // shipmentModel.canCustomerTrack for the exact policy. Enforced
        // here regardless of how the client obtained this shipment's ID,
        // so a client that already has a cached copy of the document
        // (e.g. from /exports/available) cannot bypass the check by simply
        // not calling this endpoint — every screen that shows live
        // tracking is required to hit this route first.
        if (!exportData.canCustomerTrack(req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You are not authorized to track this shipment.' });
        }

        const customerView = exportData.toCustomerView();

        res.json({
            export: customerView,
            startLocation: exportData.startLocation,
            endLocation: exportData.endLocation,
            intermediateLocations: exportData.intermediateLocations,
            routes: exportData.routes,
            status: exportData.status,
        });
    } catch (err) {
        console.error('Error fetching tracking info:', err);
        res.status(500).json({ error: 'Failed to fetch tracking info' });
    }
});

/**
 * GET /api/customer/track/:exportId/events
 * Customer-facing shipment timeline — same permission check as /track,
 * filtered to event types relevant to a customer (no rejection reasons,
 * no vendor-only reassignment metadata).
 */
router.get('/track/:exportId/events', async (req, res) => {
    try {
        const exportData = await Export.findById(req.params.exportId);
        if (!exportData) {
            return res.status(404).json({ error: 'Export not found' });
        }
        if (!exportData.canCustomerTrack(req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You are not authorized to track this shipment.' });
        }

        const events = await ShipmentEvent.find({
            shipment: exportData._id,
            eventType: { $in: CUSTOMER_VISIBLE_EVENT_TYPES },
        })
            .select('eventType timestamp')
            .sort({ timestamp: 1 });

        res.json(events);
    } catch (err) {
        console.error('Error fetching shipment events:', err);
        res.status(500).json({ error: 'Failed to fetch shipment events' });
    }
});

/**
 * GET /api/customer/track/:exportId/location
 * Live vehicle location for a shipment the customer is permitted to track.
 * Reuses the same Shipment -> Vehicle -> Device resolution the vendor/
 * driver location endpoints already use (Stage 2/3 IoT read-side) — this
 * does not add a second location source, just a permission-checked read
 * of the same one. Returns null (not fabricated coordinates) when no
 * device is linked or it has never reported a location.
 */
router.get('/track/:exportId/location', async (req, res) => {
    try {
        const exportData = await Export.findById(req.params.exportId);
        if (!exportData) {
            return res.status(404).json({ error: 'Export not found' });
        }
        if (!exportData.canCustomerTrack(req.user.id)) {
            return res.status(403).json({ error: 'Access denied. You are not authorized to track this shipment.' });
        }

        const vehicle = await Vehicle.findById(exportData.vehicle);
        if (!vehicle || !vehicle.deviceId) {
            return res.json({ location: null });
        }
        const device = await Device.findOne({ deviceName: vehicle.deviceId });
        const locations = device?.deviceLocation || [];
        const latest = locations.length > 0 ? locations[locations.length - 1] : null;

        res.json({ location: latest });
    } catch (err) {
        console.error('Error fetching customer-facing location:', err);
        res.status(500).json({ error: 'Failed to fetch location' });
    }
});

/**
 * GET /api/customer/dashboard/:customerId
 * Get dashboard data for customer
 */
router.get('/dashboard/:customerId', async (req, res) => {
    try {
        if (req.params.customerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your account.' });
        }
        const customer = await Customer.findById(req.params.customerId).select('-password');
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        // Get active exports in customer's area
        const activeExports = await Export.find({
            status: STATUSES.IN_TRANSIT,
            routes: { $in: [customer.district, customer.state] }
        })
            .populate('vendorId', 'name')
            .populate('driver', 'name')
            .sort({ startDate: -1 })
            .limit(10);

        // Get vendor count
        const vendorCount = await Vendor.countDocuments({});

        // Get active deliveries count
        const activeCount = await Export.countDocuments({ status: STATUSES.IN_TRANSIT });

        res.json({
            customer: {
                name: customer.name,
                state: customer.state,
                district: customer.district,
            },
            stats: {
                totalVendors: vendorCount,
                activeDeliveries: activeCount,
                nearbyDeliveries: activeExports.length,
            },
            nearbyExports: activeExports.map((exp) => exp.toCustomerView()),
        });
    } catch (err) {
        console.error('Error fetching dashboard:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ═══════════════════════════════════════════════════════════════════
// Stage 11 — Rescue Marketplace (Customer side)
// Identity always from req.user.id (JWT). A Customer may only ever act on
// their own interest records — enforced inside rescueService, not trusted
// from the request body.
// ═══════════════════════════════════════════════════════════════════

function handleRescueError(res, err, fallbackMessage) {
  if (err instanceof rescueService.RescueError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
}

// PUT /api/customer/rescue-preferences — explicit opt-in gate + location
// capture (Phase 9). Never invoked implicitly; the customer must choose to
// enable this, and may disable it again at any time without affecting any
// other Fresh Goods functionality.
// Body: { optIn: boolean, latitude?: number, longitude?: number }
router.put('/rescue-preferences', async (req, res) => {
  try {
    const { optIn, latitude, longitude } = req.body;
    const customer = await rescueService.setRescuePreferences(req.user.id, { optIn, latitude, longitude });
    res.json({ rescueOptIn: customer.rescueOptIn, locationUpdatedAt: customer.locationUpdatedAt });
  } catch (err) {
    handleRescueError(res, err, 'Failed to update rescue preferences');
  }
});

// GET /api/customer/rescue-sales — nearby, eligible, published rescue
// opportunities only. Returns [] (not an error) when the customer hasn't
// opted in or has no usable location — the empty state is meaningful, not
// a failure.
router.get('/rescue-sales', async (req, res) => {
  try {
    const sales = await rescueService.listPublishedRescueSalesForCustomer(req.user.id);
    res.json(sales);
  } catch (err) {
    handleRescueError(res, err, 'Failed to fetch rescue sales');
  }
});

// GET /api/customer/rescue-sales/:id
router.get('/rescue-sales/:id', async (req, res) => {
  try {
    const sale = await rescueService.getRescueSaleForCustomer(req.user.id, req.params.id);
    res.json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to fetch rescue sale');
  }
});

// POST /api/customer/rescue-sales/:id/interest — "I'm interested" (not a purchase).
router.post('/rescue-sales/:id/interest', async (req, res) => {
  try {
    const interest = await rescueService.expressInterest(req.user.id, req.params.id);
    res.json(interest);
  } catch (err) {
    handleRescueError(res, err, 'Failed to record interest');
  }
});

// DELETE /api/customer/rescue-sales/:id/interest — withdraw interest.
router.delete('/rescue-sales/:id/interest', async (req, res) => {
  try {
    const interest = await rescueService.withdrawInterest(req.user.id, req.params.id);
    res.json(interest);
  } catch (err) {
    handleRescueError(res, err, 'Failed to withdraw interest');
  }
});

module.exports = router;
