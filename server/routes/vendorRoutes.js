const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Vendor = require('../models/vendorModel');
const Driver = require('../models/driverModel');
const Customer = require('../models/customerModel');
const Vehicle = require('../models/VehicleModel');
const Device = require('../models/deviceModel');
const Export = require('../models/shipmentModel');
const ShipmentEvent = require('../models/shipmentEventModel');
const { authorize } = require('../middleware/auth');
const { STATUSES, assertTransition, DELETABLE_STATUSES } = require('../utils/shipmentStateMachine');
const logShipmentEvent = require('../utils/logShipmentEvent');
const { createNotification } = require('../services/notificationService');
const notifyEligibleCustomers = require('../utils/notifyEligibleCustomers');
const { evaluateShipmentCondition } = require('../services/conditionEngine');
const rescueService = require('../services/rescueService');
const rerouteService = require('../services/rerouteService');

// Every route in this file is vendor-only. Scoped with router.use() rather
// than at the server.js mount point, because serviceRequestRoutes.js shares
// the same '/api/vendor' prefix and needs different per-route roles.
router.use(authorize('Vendor'));

// Driver Management Routes For Vendor
//
// Drivers do not self-register (see server/routes/signupRoute.js — the
// Driver branch is rejected there). A Driver account only ever comes into
// existence via POST /api/vendor/drivers below, created by an authenticated
// Vendor, with that Vendor set as the driver's single owner (Driver.vendor).
// vendorId is NEVER taken from the request body/URL/query — always
// req.user.id from the verified JWT.

// GET /api/vendor/all — the calling vendor's own drivers.
router.get('/all', async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.user.id).populate({
      path: 'drivers',
      populate: { path: 'vehicle', select: 'vehicleNumber brand capacity deviceId' },
    });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    res.json(vendor.drivers);
  } catch (err) {
    console.error('Error fetching vendor drivers:', err);
    res.status(500).json({ error: 'Failed to fetch drivers for vendor' });
  }
});

// GET /api/vendor/profile/:vendorId — the vendor's own account record.
// Mirrors GET /api/driver/profile/:driverId and GET
// /api/customer/profile/:customerId — same ownership check, same
// password-stripped shape.
router.get('/profile/:vendorId', async (req, res) => {
  try {
    if (req.params.vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your account.' });
    }
    const vendor = await Vendor.findById(req.params.vendorId).select('-password');
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    res.json(vendor);
  } catch (err) {
    console.error('Error fetching vendor profile:', err);
    res.status(500).json({ error: 'Failed to fetch vendor profile' });
  }
});

// POST /api/vendor/drivers — create a new Driver account owned by the
// calling vendor. This is the ONLY way a Driver account is created.
router.post('/drivers', async (req, res) => {
  const { name, username, email, mobile, password, licenseNo, state, district } = req.body;

  if (!name || !username || !email || !mobile || !password || !licenseNo || !state || !district) {
    return res.status(400).json({
      error: 'name, username, email, mobile, password, licenseNo, state and district are required',
    });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  try {
    const [existingUsername, existingEmail] = await Promise.all([
      Driver.findOne({ username }).select('_id'),
      Driver.findOne({ email }).select('_id'),
    ]);
    if (existingUsername) {
      return res.status(409).json({ error: 'That username is already taken.' });
    }
    if (existingEmail) {
      return res.status(409).json({ error: 'A driver with that email already exists.' });
    }

    const driver = new Driver({
      name,
      username,
      email,
      mobileNo: mobile,
      password,
      licenseNo,
      state,
      district,
      vendor: req.user.id,
    });
    await driver.save();

    await Vendor.findByIdAndUpdate(req.user.id, { $addToSet: { drivers: driver._id } });

    // driver.toJSON() (defined on the model) strips the password hash.
    res.status(201).json({ success: true, message: 'Driver created', driver });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || 'field';
      return res.status(409).json({ error: `That ${field} is already in use.` });
    }
    console.error('Create Driver Error:', err);
    res.status(500).json({ error: 'Failed to create driver' });
  }
});

// POST /api/vendor/remove-driver — un-assign a driver the calling vendor
// owns. Does not delete the Driver account (it may have real work/shipment
// history attached) — just detaches it from this vendor. Membership in the
// vendor's own `drivers[]` array (not `driver.vendor`) is the source of
// truth for "is this mine", so a handful of pre-existing drivers claimed
// under the old add-driver model (which never set `driver.vendor`) can
// still be removed correctly.
router.post('/remove-driver', async (req, res) => {
  const { driverId } = req.body;

  if (!driverId) {
    return res.status(400).json({ error: 'Missing driverId' });
  }

  try {
    const vendor = await Vendor.findById(req.user.id);
    if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
    if (!vendor.drivers.some((id) => id.toString() === driverId)) {
      return res.status(403).json({ error: 'Access denied. Not your driver.' });
    }

    vendor.drivers = vendor.drivers.filter((id) => id.toString() !== driverId);
    await vendor.save();
    // Clear ownership only when this vendor actually was the recorded
    // owner — never blindly null out a field we didn't set.
    await Driver.updateOne({ _id: driverId, vendor: req.user.id }, { $set: { vendor: null } });

    res.json({ success: true, message: 'Driver removed from vendor' });
  } catch (err) {
    console.error('Remove Driver Error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

//Vehicle Management Routes For Vendor


// ✅ Get all vehicles assigned to a vendor
router.get('/vehicles', async (req, res) => {
  const { vendorId } = req.query;

  if (vendorId && vendorId !== req.user.id) {
    return res.status(403).json({ message: 'Access denied. Not your account.' });
  }

  try {
    const vendor = await Vendor.findById(req.user.id).populate({
      path: 'vehicles',
      populate: [
        { path: 'driver', select: 'name mobileNo' },
        { path: 'device' },
      ],
    });
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    res.json(vendor.vehicles || []);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching vehicles', error: err.message });
  }
});

// All of the authenticated vendor's own devices — available and assigned
// — for the Device Management screen. Populates which vehicle a device is
// on, if any.
router.get('/devices', async (req, res) => {
  try {
    const devices = await Device.find({ vendor: req.user.id })
      .populate({ path: 'vehicle', select: 'vehicleNumber' })
      .sort({ createdAt: -1 });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching devices', error: err.message });
  }
});

// Get all of the authenticated vendor's own devices that are not yet
// assigned to a vehicle. Devices are Vendor-owned (Device.vendor) — this
// never returns another vendor's devices, registered or assigned.
router.get('/available-devices', async (req, res) => {
  try {
    const devices = await Device.find({ vendor: req.user.id, isAssigned: false });
    res.json(devices);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching devices', error: err.message });
  }
});

// Register a new Device under the authenticated vendor. vendor is always
// req.user.id — never trusted from the request body. deviceName stays the
// unique identifier the external IoT hardware writer matches on; that
// uniqueness is global (enforced by the schema), ownership is per-vendor.
router.post('/register-device', async (req, res) => {
  const { deviceName } = req.body;

  if (!deviceName || !deviceName.trim()) {
    return res.status(400).json({ message: 'deviceName is required' });
  }

  try {
    const device = new Device({
      deviceName: deviceName.trim(),
      vendor: req.user.id,
      isAssigned: false,
    });
    await device.save();
    res.status(201).json({ message: 'Device registered', device });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'That device name is already registered.' });
    }
    res.status(500).json({ message: 'Error registering device', error: err.message });
  }
});

// Assign an available, vendor-owned device to a vendor-owned vehicle that
// doesn't already have one. Rejects any cross-vendor vehicle/device and any
// device that's already assigned elsewhere — never silently reassigns.
router.post('/assign-device', async (req, res) => {
  const { vehicleId, deviceName } = req.body;

  if (!vehicleId || !deviceName) {
    return res.status(400).json({ message: 'vehicleId and deviceName are required' });
  }

  try {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || !vehicle.vendor || vehicle.vendor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. That vehicle is not yours.' });
    }
    if (vehicle.deviceId) {
      return res.status(400).json({ message: 'This vehicle already has a device. Remove it first.' });
    }

    const device = await Device.findOne({ deviceName, vendor: req.user.id, isAssigned: false });
    if (!device) {
      return res.status(400).json({ message: 'Device not found, not yours, or already assigned.' });
    }

    vehicle.deviceId = device.deviceName;
    vehicle.device = device._id;
    await vehicle.save();

    device.isAssigned = true;
    device.vehicle = vehicle._id;
    await device.save();

    res.json({ message: 'Device assigned to vehicle', vehicle, device });
  } catch (err) {
    res.status(500).json({ message: 'Error assigning device', error: err.message });
  }
});

// Detach the device currently on a vendor-owned vehicle. The device becomes
// available again — it is never deleted, it's a reusable asset.
router.post('/unassign-device', async (req, res) => {
  const { vehicleId } = req.body;

  if (!vehicleId) {
    return res.status(400).json({ message: 'vehicleId is required' });
  }

  try {
    const vehicle = await Vehicle.findById(vehicleId);
    if (!vehicle || !vehicle.vendor || vehicle.vendor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. That vehicle is not yours.' });
    }
    if (!vehicle.deviceId) {
      return res.status(400).json({ message: 'This vehicle has no device assigned.' });
    }

    const device = await Device.findOne({ deviceName: vehicle.deviceId, vendor: req.user.id });

    vehicle.deviceId = undefined;
    vehicle.device = null;
    await vehicle.save();

    if (device) {
      device.isAssigned = false;
      device.vehicle = null;
      await device.save();
    }

    res.json({ message: 'Device removed from vehicle', vehicle });
  } catch (err) {
    res.status(500).json({ message: 'Error removing device', error: err.message });
  }
});

// ✅ Add a vehicle and (optionally) assign a device at the same time. A
// vehicle may now be created with no device — one can be attached later
// via /assign-device.
router.post('/add-vehicle', async (req, res) => {
  const { _id, vehicleNumber, brand, capacity, deviceId, vendorId } = req.body;

  if (!_id || !vehicleNumber || !brand || !capacity || !vendorId) {
    return res.status(400).json({ message: 'Vehicle ID, number, brand, capacity and vendorId are required' });
  }
  if (vendorId !== req.user.id) {
    return res.status(403).json({ message: 'Access denied. Not your account.' });
  }

  try {
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' });

    let device = null;
    if (deviceId) {
      // Ensure device exists, belongs to this vendor, and is available
      device = await Device.findOne({ deviceName: deviceId, vendor: vendorId, isAssigned: false });
      if (!device) return res.status(400).json({ message: 'Device not found, not yours, or already assigned' });
    }

    // Create vehicle
    const vehicle = new Vehicle({
      _id, vehicleNumber, brand, capacity,
      vendor: vendorId,
      ...(device ? { deviceId: device.deviceName, device: device._id } : {}),
    });
    await vehicle.save();

    // Update vendor and device
    vendor.vehicles.push(vehicle._id);
    await vendor.save();

    if (device) {
      device.isAssigned = true;
      device.vehicle = vehicle._id;
      await device.save();
    }

    res.status(201).json({ message: 'Vehicle added successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Error adding vehicle', error: err.message });
  }
});

// Standing Driver -> Vehicle assignment. Both must belong to the
// authenticated vendor. If either side already has a reciprocal
// assignment, it is cleared first so the 1:1 invariant (one driver per
// vehicle, one vehicle per driver) never breaks — done as a single
// sequence of ownership-checked writes, not a silent cross-vendor move.
router.post('/assign-driver-vehicle', async (req, res) => {
  const { driverId, vehicleId } = req.body;

  if (!driverId || !vehicleId) {
    return res.status(400).json({ message: 'driverId and vehicleId are required' });
  }

  try {
    const owningVendor = await Vendor.findById(req.user.id).select('drivers vehicles');
    if (!owningVendor) return res.status(404).json({ message: 'Vendor not found' });
    if (!owningVendor.drivers.some((d) => d.toString() === driverId)) {
      return res.status(403).json({ message: 'That driver is not one of your drivers.' });
    }
    if (!owningVendor.vehicles.some((v) => v.toString() === String(vehicleId))) {
      return res.status(403).json({ message: 'That vehicle is not one of your vehicles.' });
    }

    const [driver, vehicle] = await Promise.all([
      Driver.findById(driverId),
      Vehicle.findById(vehicleId),
    ]);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' });

    // Clear any existing reciprocal assignments first.
    if (driver.vehicle && driver.vehicle !== vehicle._id) {
      await Vehicle.updateOne({ _id: driver.vehicle, driver: driver._id }, { $set: { driver: null } });
    }
    if (vehicle.driver && vehicle.driver.toString() !== driverId) {
      await Driver.updateOne({ _id: vehicle.driver, vehicle: vehicle._id }, { $set: { vehicle: null } });
    }

    driver.vehicle = vehicle._id;
    vehicle.driver = driver._id;
    await Promise.all([driver.save(), vehicle.save()]);

    res.json({ message: 'Driver assigned to vehicle', driver, vehicle });
  } catch (err) {
    res.status(500).json({ message: 'Error assigning driver to vehicle', error: err.message });
  }
});

// Clear a driver's standing vehicle assignment (and the vehicle's
// reciprocal driver reference). Device stays exactly where it is — it's
// attached to the Vehicle, not the Driver.
router.post('/unassign-driver-vehicle', async (req, res) => {
  const { driverId } = req.body;

  if (!driverId) {
    return res.status(400).json({ message: 'driverId is required' });
  }

  try {
    const owningVendor = await Vendor.findById(req.user.id).select('drivers');
    if (!owningVendor) return res.status(404).json({ message: 'Vendor not found' });
    if (!owningVendor.drivers.some((d) => d.toString() === driverId)) {
      return res.status(403).json({ message: 'That driver is not one of your drivers.' });
    }

    const driver = await Driver.findById(driverId);
    if (!driver) return res.status(404).json({ message: 'Driver not found' });

    if (driver.vehicle) {
      await Vehicle.updateOne({ _id: driver.vehicle, driver: driver._id }, { $set: { driver: null } });
    }
    driver.vehicle = null;
    await driver.save();

    res.json({ message: 'Driver unassigned from vehicle', driver });
  } catch (err) {
    res.status(500).json({ message: 'Error unassigning driver', error: err.message });
  }
});

// Export Management for the vendor



// Assuming your models are imported
// const Driver = require('../models/Driver');
// const Vehicle = require('../models/Vehicle');
// const Export = require('../models/Export');

// GET /api/vendor/exports - Get all exports for a vendor
router.get('/exports', async (req, res) => {
  try {
    const { vendorId } = req.query;

    if (!vendorId) {
      return res.status(400).json({ error: 'Vendor ID is required' });
    }
    if (vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your account.' });
    }

    const exports = await Export.find({ vendorId })
      .populate('driver', 'name')
      .populate('vehicle', 'vehicleNumber model')
      .sort({ createdAt: -1 });

    res.json(exports);
  } catch (error) {
    console.error('Error fetching exports:', error);
    res.status(500).json({ error: 'Failed to fetch exports' });
  }
});

router.get('/availableResources', async (req, res) => {
  try {
    const { vendorId, startDate, endDate } = req.query;

    if (!vendorId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Vendor ID, start date, and end date are required' });
    }
    if (vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your account.' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Fetch vendor with list of drivers and vehicles
    const vendor = await Vendor.findById(vendorId).select('drivers vehicles');
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Get overlapping exports (those that clash with given date range)
    const overlappingExports = await Export.find({
      $or: [
        { startDate: { $lte: end }, endDate: { $gte: start } }
      ]
    });

    // Extract busy drivers and vehicles
    const busyDriverIds = overlappingExports.map(exp => exp.driver?.toString());
    const busyVehicleIds = overlappingExports.map(exp => exp.vehicle?.toString());

    // Filter vendor's drivers who are NOT busy
    const availableDrivers = await Driver.find({
      _id: { $in: vendor.drivers, $nin: busyDriverIds }
    }).select('name _id');

    // Filter vendor's vehicles that are NOT busy
    const availableVehicles = await Vehicle.find({
      _id: { $in: vendor.vehicles, $nin: busyVehicleIds }
    }).select('vehicleNumber model _id');

    res.json({
      drivers: availableDrivers,
      vehicles: availableVehicles
    });
  } catch (error) {
    console.error('Error fetching available resources:', error);
    res.status(500).json({ error: 'Failed to fetch available resources' });
  }
});


router.post('/export/add/:vendorId', async (req, res) => {
  try {
    const { vendorId } = req.params;
    if (vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your account.' });
    }
    const {
      itemName, startDate, endDate, quantity, costPrice, salePrice,
      driver, vehicle, salary, startLocation, endLocation,
      // Optional Stage 4 additions — none of these are sent by the current
      // mobile create form, so all must tolerate being absent.
      product, unit, instructions, expectedDropTime, customer,
    } = req.body;

    if (!itemName || !startDate || !endDate || !quantity || !costPrice ||
      !salePrice || !driver || !vehicle || !salary || !startLocation || !endLocation) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (Number(quantity) <= 0 || Number(costPrice) < 0 || Number(salePrice) < 0 || Number(salary) < 0) {
      return res.status(400).json({ error: 'quantity, costPrice, salePrice and salary must be non-negative (quantity must be greater than 0)' });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ error: 'endDate must be a valid date on or after startDate' });
    }

    // A vendor may only assign resources they actually control — without
    // this check, any authenticated vendor could pass another vendor's
    // driverId/vehicleId here and it would silently succeed (the driver/
    // vehicle documents themselves don't carry an ownership check on their
    // own, unlike every other route in this file).
    const owningVendor = await Vendor.findById(vendorId).select('drivers vehicles');
    if (!owningVendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    if (!owningVendor.drivers.some((d) => d.toString() === driver)) {
      return res.status(403).json({ error: 'That driver is not one of your drivers.' });
    }
    if (!owningVendor.vehicles.some((v) => v.toString() === String(vehicle))) {
      return res.status(403).json({ error: 'That vehicle is not one of your vehicles.' });
    }
    if (customer) {
      if (!mongoose.isValidObjectId(customer)) {
        return res.status(400).json({ error: 'Invalid customer id' });
      }
      const customerExists = await Customer.exists({ _id: customer });
      if (!customerExists) {
        return res.status(400).json({ error: 'Customer not found' });
      }
    }

    // Terminal-state shipments (REJECTED/CANCELLED never happened;
    // COMPLETED already finished) don't actually occupy the driver/vehicle
    // for these dates — without this exclusion, a driver could never be
    // reassigned to overlapping dates once any past job in that window
    // reached a terminal state.
    const conflict = await Export.find({
      $and: [
        { startDate: { $lte: end } },
        { endDate: { $gte: start } },
        { status: { $nin: [STATUSES.COMPLETED, STATUSES.REJECTED, STATUSES.CANCELLED] } },
        { $or: [{ driver }, { vehicle }] }
      ]
    });

    if (conflict.length > 0) {
      return res.status(400).json({ error: 'Driver or vehicle is not available for selected dates' });
    }

    // Resolve the device already mounted on this vehicle (if any) so the
    // shipment carries a direct reference without changing how the IoT
    // read-side actually looks up sensor/location data (still by
    // vehicle.deviceId === Device.deviceName).
    const vehicleDoc = await Vehicle.findById(vehicle);
    const deviceDoc = vehicleDoc?.deviceId
      ? await Device.findOne({ deviceName: vehicleDoc.deviceId })
      : null;

    const newExport = new Export({
      vendorId,
      product: product || null,
      itemName,
      unit: unit || null,
      startDate: start,
      endDate: end,
      expectedDropTime: expectedDropTime ? new Date(expectedDropTime) : null,
      quantity,
      costPrice,
      salePrice,
      driver,
      vehicle,
      device: deviceDoc?._id || null,
      customer: customer || null,
      driverSalary: salary,
      instructions: instructions || null,
      startLocation,
      endLocation,
      status: STATUSES.ASSIGNED,
    });

    await newExport.save();

    const dates = [];
    let curr = new Date(start);
    while (curr <= end) {
      dates.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    const driverDoc = await Driver.findByIdAndUpdate(driver, {
      $push: {
        work: {
          // exportId ties this embedded record to the shipment that
          // created it, so it can be removed precisely on delete (see
          // DELETE /export/:id below) instead of matching by vendorId
          // alone, which previously matched either every work entry for
          // that vendor or (due to a string/ObjectId mismatch) none of
          // them.
          exportId: newExport._id,
          vendorId,
          workDuration: [{ startDate: start, endDate: end }],
          salary,
          isPaid: false
        },
        workDates: { $each: dates }
      }
    }, { new: true });

    await logShipmentEvent(newExport._id, 'SHIPMENT_CREATED', vendorId, 'Vendor');
    await logShipmentEvent(newExport._id, 'DRIVER_ASSIGNED', vendorId, 'Vendor', { driver });
    await createNotification({
      recipientId: driver,
      recipientModel: 'Driver',
      type: 'JOB_ASSIGNED',
      title: 'New shipment assigned',
      message: `You've been assigned to deliver ${itemName}.`,
      relatedEntityType: 'Shipment',
      relatedEntityId: newExport._id,
      recipientPushToken: driverDoc?.expoPushToken,
    });

    res.status(201).json({ message: 'Export created successfully', export: newExport });
  } catch (error) {
    console.error('Error creating export:', error);
    res.status(500).json({ error: 'Failed to create export' });
  }
});

// GET /api/vendor/export/:id - Get single export details
router.get('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const exportData = await Export.findById(id)
      .populate('driver', 'name email mobileNo')
      .populate('vehicle', 'vehicleNumber model brand capacity');

    if (!exportData) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (exportData.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    res.json(exportData);
  } catch (error) {
    console.error('Error fetching export:', error);
    res.status(500).json({ error: 'Failed to fetch export' });
  }
});

// PUT /api/vendor/export/:id - Update export status (not currently called by
// the mobile app, which uses the dedicated start/complete endpoints below;
// kept for API completeness, now gated by the same state machine)
router.put('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'status is required' });
    }

    const existing = await Export.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (existing.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    try {
      assertTransition(existing.status, status);
    } catch (transitionError) {
      return res.status(400).json({ error: transitionError.message });
    }

    const updatedExport = await Export.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    ).populate('driver', 'name').populate('vehicle', 'vehicleNumber model');

    await logShipmentEvent(id, status === STATUSES.CANCELLED ? 'SHIPMENT_CANCELLED' : 'SHIPMENT_STATUS_CHANGED', req.user.id, 'Vendor', { from: existing.status, to: status });

    res.json({ message: 'Export updated successfully', export: updatedExport });
  } catch (error) {
    console.error('Error updating export:', error);
    res.status(500).json({ error: 'Failed to update export' });
  }
});

router.delete('/export/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const exportData = await Export.findById(id);

    if (!exportData) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (exportData.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    if (!DELETABLE_STATUSES.includes(exportData.status)) {
      return res.status(400).json({ error: `Cannot delete export in status ${exportData.status}` });
    }

    // Remove the embedded work record this shipment created. Previously
    // this matched `work: { vendorId: exportData.vendorId }` against
    // `exportData.driver` — a string/ObjectId mismatch meant it silently
    // matched nothing, so deleted shipments left stale work entries behind
    // forever. It also targeted exportData.driver, which is null on a
    // REJECTED shipment (deletable, per DELETABLE_STATUSES) even though
    // the original driver's work[] entry (tagged at creation, see
    // /export/add) still exists. Matching by the shipment's own exportId
    // across all drivers fixes both problems.
    await Driver.updateMany(
      { 'work.exportId': exportData._id },
      {
        $pull: {
          work: { exportId: exportData._id },
          // workDates has no per-shipment key (flat array shared across
          // all of a driver's shipments), so this remains a best-effort
          // range removal — precise only when no other shipment for this
          // driver overlaps the same dates.
          workDates: {
            $gte: exportData.startDate,
            $lte: exportData.endDate
          }
        }
      }
    );

    await Export.findByIdAndDelete(id);

    res.json({ message: 'Export deleted successfully' });
  } catch (error) {
    console.error('Error deleting export:', error);
    res.status(500).json({ error: 'Failed to delete export' });
  }
});

// vendor Home placeholder

router.get('/export/passedstatus/:vendorId', async (req, res) => {
  const { vendorId } = req.params;

  if (vendorId !== req.user.id) {
    return res.status(403).json({ message: 'Access denied. Not your account.' });
  }

  try {
    const startedExports = await Export.find({
      vendorId: vendorId,
      status: STATUSES.IN_TRANSIT
    })
      .populate('driver', 'name mobileNo')
      .populate('vehicle')
      .populate('vendorId', 'name mobileNo')
      .populate('customer', 'name mobileNo')
      .populate('device', 'deviceName isAssigned');

    res.status(200).json(startedExports);
  } catch (error) {
    console.error('Error fetching started exports by vendor:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});


// get sensor data for export with optional date filtering
router.get('/device/sensor-data/:exportId', async (req, res) => {
  console.log('Fetching sensor data for export ID:', req.params.exportId);
  try {
    const exp = await Export.findById(req.params.exportId);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    const vehicle = await Vehicle.findById(exp.vehicle);
    if (!vehicle || !vehicle.deviceId)
      return res.status(404).json({ error: 'Associated vehicle or device not found' });

    const device = await Device.findOne({ deviceName: vehicle.deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    let sensorData = device.deviceData || [];

    // Filter by date if provided
    const { date, startDate, endDate } = req.query;

    if (date) {
      // Filter for specific date (YYYY-MM-DD format)
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      sensorData = sensorData.filter(d => {
        const timestamp = new Date(d.timestamp);
        return timestamp >= targetDate && timestamp < nextDate;
      });
    } else if (startDate && endDate) {
      // Filter for date range
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // Include entire end date

      sensorData = sensorData.filter(d => {
        const timestamp = new Date(d.timestamp);
        return timestamp >= start && timestamp <= end;
      });
    }

    return res.json(sensorData);
  } catch (err) {
    console.error('Sensor data fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch sensor data' });
  }
});


// Live Location Data
router.get('/device/location-data/:exportId', async (req, res) => {
  console.log('Fetching location data for export ID:', req.params.exportId);

  try {
    const exp = await Export.findById(req.params.exportId);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    const vehicle = await Vehicle.findById(exp.vehicle);
    if (!vehicle || !vehicle.deviceId)
      return res.status(404).json({ error: 'Associated vehicle or device not found' });

    const device = await Device.findOne({ deviceName: vehicle.deviceId });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    return res.json(device.deviceLocation); // ✅ Only location data
  } catch (err) {
    console.error('Location data fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch location data' });
  }
});


// Stage 10 — condition/perishability status for a shipment. Evaluates the
// latest sensor reading through the Condition Engine, persists the result,
// and (on a real status transition while IN_TRANSIT) fires a de-duplicated
// vendor alert. See server/services/conditionEngine.js for the pipeline.
router.get('/device/condition/:exportId', async (req, res) => {
  try {
    const exp = await Export.findById(req.params.exportId);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    const result = await evaluateShipmentCondition(exp._id);

    return res.json({
      shipmentId: exp._id,
      conditionStatus: result.conditionStatus,
      riskStatus: result.riskStatus,
      reason: result.reason,
      triggeredSensors: result.triggeredSensors,
      sensorSnapshot: result.sensorSnapshot,
      dataQuality: result.dataQuality,
      ruleSource: result.ruleSource,
      evaluatedAt: result.evaluatedAt,
      latestReadingTimestamp: result.latestReadingTimestamp,
    });
  } catch (err) {
    console.error('Condition evaluation error:', err);
    res.status(500).json({ error: 'Failed to evaluate shipment condition' });
  }
});


// Push intermediate location
router.post('/export/intermediateLocation/push/:export_id', async (req, res) => {
  const { export_id } = req.params;
  const { latitude, longitude } = req.body;

  if (latitude === undefined || longitude === undefined) {
    return res.status(400).json({ error: 'Latitude and Longitude are required' });
  }

  try {
    const existing = await Export.findById(export_id);
    if (!existing) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (existing.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    const updatedExport = await Export.findByIdAndUpdate(
      export_id,
      {
        $push: {
          intermediateLocations: { latitude, longitude }
        }
      },
      { new: true } // return the updated document
    );

    return res.status(200).json({
      message: 'Intermediate location added successfully',
      updatedExport
    });
  } catch (error) {
    console.error('Error pushing intermediate location:', error);
    res.status(500).json({ error: 'Failed to update intermediate location' });
  }
});

// GET intermediate locations for an export
router.get('/export/intermediateLocation/get/:exportId', async (req, res) => {
  const { exportId } = req.params;

  try {
    const exp = await Export.findById(exportId);

    if (!exp) {
      return res.status(404).json({ error: 'Export not found' });
    }
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    return res.json(exp.intermediateLocations);
  } catch (err) {
    console.error('Error fetching intermediate locations:', err);
    return res.status(500).json({ error: 'Server error while fetching intermediate locations' });
  }
});

// GET all exports for a vendor (with driver info)
router.get('/exports/:vendorId', async (req, res) => {
  try {
    if (req.params.vendorId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your account.' });
    }
    const exports = await Export.find({ vendorId: req.params.vendorId })
      .populate('driver', 'name mobileNo')
      .populate('vehicle', 'vehicleNumber brand capacity')
      .populate('customer', 'name mobileNo')
      .populate('device', 'deviceName isAssigned')
      .sort({ createdAt: -1 });
    res.json(exports);
  } catch (err) {
    console.error('Error fetching vendor exports:', err);
    res.status(500).json({ error: 'Failed to fetch exports' });
  }
});

// Vendor starts an export (after driver accepts). Driver-initiated start
// (driverRoutes.js) reaches the same ACCEPTED -> IN_TRANSIT transition
// through the same state-machine check, so whichever side calls first is
// the one that actually starts it.
router.put('/export/start/:exportId', async (req, res) => {
  try {
    const exp = await Export.findById(req.params.exportId);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    try {
      assertTransition(exp.status, STATUSES.IN_TRANSIT);
    } catch (transitionError) {
      return res.status(400).json({ error: transitionError.message });
    }

    const updated = await Export.findByIdAndUpdate(
      req.params.exportId,
      { status: STATUSES.IN_TRANSIT },
      { new: true }
    ).populate('driver', 'name mobileNo');

    await logShipmentEvent(exp._id, 'DELIVERY_STARTED', req.user.id, 'Vendor');
    await notifyEligibleCustomers(exp, {
      type: 'SHIPMENT_STATUS_CHANGED',
      title: 'Your delivery is on the way',
      message: `${exp.itemName} is now in transit.`,
    });

    res.json({ success: true, message: 'Export started', export: updated });
  } catch (err) {
    console.error('Vendor start export error:', err);
    res.status(500).json({ error: 'Failed to start export' });
  }
});

// Vendor completes an export
router.put('/export/complete/:exportId', async (req, res) => {
  try {
    const exp = await Export.findById(req.params.exportId);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    try {
      assertTransition(exp.status, STATUSES.COMPLETED);
    } catch (transitionError) {
      return res.status(400).json({ error: transitionError.message });
    }

    const updated = await Export.findByIdAndUpdate(
      req.params.exportId,
      { status: STATUSES.COMPLETED },
      { new: true }
    ).populate('driver', 'name mobileNo');

    await logShipmentEvent(exp._id, 'DELIVERY_COMPLETED', req.user.id, 'Vendor');
    await notifyEligibleCustomers(exp, {
      type: 'SHIPMENT_STATUS_CHANGED',
      title: 'Delivery completed',
      message: `${exp.itemName} has been delivered.`,
    });

    res.json({ success: true, message: 'Export completed', export: updated });
  } catch (err) {
    console.error('Vendor complete export error:', err);
    res.status(500).json({ error: 'Failed to complete export' });
  }
});

// GET /api/vendor/export/:id/events — shipment timeline for the owning vendor
router.get('/export/:id/events', async (req, res) => {
  try {
    const exp = await Export.findById(req.params.id);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    const events = await ShipmentEvent.find({ shipment: exp._id }).sort({ timestamp: 1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching shipment events:', err);
    res.status(500).json({ error: 'Failed to fetch shipment events' });
  }
});

// PUT /api/vendor/export/:id/tracking-permissions
// Body: { viewers: [{ customerId, allowed }] } — full replace of the list.
// Tracking is explicit-grant only (Stage 5 §6) — a customer not listed
// here, or listed with allowed:false, gets 403 from /api/customer/track.
router.put('/export/:id/tracking-permissions', async (req, res) => {
  try {
    const { id } = req.params;
    const { viewers } = req.body;

    if (!Array.isArray(viewers)) {
      return res.status(400).json({ error: 'viewers must be an array of { customerId, allowed }' });
    }

    const exp = await Export.findById(id);
    if (!exp) return res.status(404).json({ error: 'Export not found' });
    if (exp.vendorId.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied. Not your export.' });
    }

    for (const v of viewers) {
      if (!v.customerId || !mongoose.isValidObjectId(v.customerId)) {
        return res.status(400).json({ error: 'Each viewer entry requires a valid customerId' });
      }
    }
    const customerIds = viewers.map((v) => v.customerId);
    const foundCount = await Customer.countDocuments({ _id: { $in: customerIds } });
    if (foundCount !== new Set(customerIds).size) {
      return res.status(400).json({ error: 'One or more customerIds do not exist' });
    }

    exp.trackingViewers = viewers.map((v) => ({
      customer: v.customerId,
      allowed: v.allowed !== false,
      addedAt: new Date(),
    }));

    await exp.save();

    res.json({ success: true, message: 'Tracking permissions updated', trackingViewers: exp.trackingViewers });
  } catch (err) {
    console.error('Error updating tracking permissions:', err);
    res.status(500).json({ error: 'Failed to update tracking permissions' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Stage 11 — Rescue Marketplace (Vendor side)
// All ownership checks below come from req.user.id (JWT), never from a
// client-supplied vendorId. See server/services/rescueService.js for the
// business logic; routes here only translate RescueError -> HTTP status.
// ═══════════════════════════════════════════════════════════════════

function handleRescueError(res, err, fallbackMessage) {
  if (err instanceof rescueService.RescueError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
}

// POST /api/vendor/rescue-sales — create + publish in one step (Phase 4/6).
// Body: { shipmentId, availableQuantity, unit?, price, description?, validUntil, rescueRadiusKm? }
router.post('/rescue-sales', async (req, res) => {
  try {
    const { shipmentId, ...payload } = req.body;
    if (!shipmentId) return res.status(400).json({ error: 'shipmentId is required' });

    const sale = await rescueService.createRescueSale(req.user.id, shipmentId, payload);
    res.status(201).json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to create rescue sale');
  }
});

// GET /api/vendor/rescue-sales — the calling vendor's own rescue sales.
router.get('/rescue-sales', async (req, res) => {
  try {
    const sales = await rescueService.listVendorRescueSales(req.user.id);
    res.json(sales);
  } catch (err) {
    handleRescueError(res, err, 'Failed to fetch rescue sales');
  }
});

// GET /api/vendor/rescue-sales/:id
router.get('/rescue-sales/:id', async (req, res) => {
  try {
    const sale = await rescueService.getVendorRescueSale(req.user.id, req.params.id);
    res.json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to fetch rescue sale');
  }
});

// PUT /api/vendor/rescue-sales/:id — commercial-terms-only edit (see rescueService.updateRescueSale).
router.put('/rescue-sales/:id', async (req, res) => {
  try {
    const sale = await rescueService.updateRescueSale(req.user.id, req.params.id, req.body);
    res.json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to update rescue sale');
  }
});

// POST /api/vendor/rescue-sales/:id/cancel
router.post('/rescue-sales/:id/cancel', async (req, res) => {
  try {
    const sale = await rescueService.cancelRescueSale(req.user.id, req.params.id);
    // Stage 12: an active reroute must never keep pointing at a cancelled
    // sale. Composed here at the route layer (not inside rescueService.js)
    // so Stage 11's service stays free of a circular dependency on
    // rerouteService.js, which itself reuses rescueService.resolveVehicleLocation.
    await rerouteService.cancelActiveRerouteForShipment(sale.shipment).catch((err) => {
      console.error('Failed to cascade-cancel reroute for cancelled rescue sale:', err);
    });
    res.json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to cancel rescue sale');
  }
});

// GET /api/vendor/rescue-sales/:id/interested-buyers — approximate distance
// + contact info only for customers who have actually expressed interest.
router.get('/rescue-sales/:id/interested-buyers', async (req, res) => {
  try {
    // Ownership check happens inside getInterestedBuyers via assertVendorOwnsRescueSale.
    const buyers = await rescueService.getInterestedBuyers(req.user.id, req.params.id);
    res.json(buyers);
  } catch (err) {
    handleRescueError(res, err, 'Failed to fetch interested buyers');
  }
});

// POST /api/vendor/rescue-sales/:id/select-buyer — body: { customerId }
router.post('/rescue-sales/:id/select-buyer', async (req, res) => {
  try {
    const { customerId } = req.body;
    if (!customerId) return res.status(400).json({ error: 'customerId is required' });
    const sale = await rescueService.selectBuyer(req.user.id, req.params.id, customerId);
    res.json(sale);
  } catch (err) {
    handleRescueError(res, err, 'Failed to select buyer');
  }
});

// ═══════════════════════════════════════════════════════════════════
// Stage 12 — Smart Rerouting & Rescue Delivery (Vendor side)
// Nested under the RescueSale, since a reroute only ever exists once that
// sale has a selected buyer. See server/services/rerouteService.js for the
// full validation chain and server/services/routingService.js for the ORS
// call. Vendor identity always from req.user.id (JWT) — never trusted from
// the request body, matching every other route in this file.
// ═══════════════════════════════════════════════════════════════════

function handleRerouteError(res, err, fallbackMessage) {
  if (err instanceof rerouteService.RerouteError) {
    return res.status(err.status).json({ error: err.message, code: err.code });
  }
  console.error(fallbackMessage, err);
  return res.status(500).json({ error: fallbackMessage });
}

// POST /api/vendor/rescue-sales/:id/route-preview — stateless, no DB write.
router.post('/rescue-sales/:id/route-preview', async (req, res) => {
  try {
    const preview = await rerouteService.previewReroute(req.user.id, req.params.id);
    res.json(preview);
  } catch (err) {
    handleRerouteError(res, err, 'Failed to preview rescue route');
  }
});

// POST /api/vendor/rescue-sales/:id/confirm-reroute — the Vendor's one-click
// decision. No Driver approval gate (Core Business Decision: Vendor decides).
router.post('/rescue-sales/:id/confirm-reroute', async (req, res) => {
  try {
    const reroute = await rerouteService.confirmReroute(req.user.id, req.params.id);
    res.status(201).json(reroute);
  } catch (err) {
    handleRerouteError(res, err, 'Failed to confirm rescue reroute');
  }
});

// GET /api/vendor/rescue-sales/:id/reroute — current/most recent reroute for this sale.
router.get('/rescue-sales/:id/reroute', async (req, res) => {
  try {
    const reroute = await rerouteService.getRerouteForVendor(req.user.id, req.params.id);
    res.json(reroute);
  } catch (err) {
    handleRerouteError(res, err, 'Failed to fetch reroute');
  }
});

module.exports = router;
