/**
 * Stage 4 one-time data migration.
 *
 * What it does, and why:
 *  1. Export/Shipment documents: collapses the old two-track
 *     status + driverResponse pair into the single canonical `status`
 *     enum (see utils/shipmentStateMachine.js), then removes the now-dead
 *     driverResponse field.
 *       - status 'Pending' + driverResponse 'pending'   -> ASSIGNED
 *       - status 'Pending' + driverResponse 'accepted'  -> ACCEPTED
 *       - status 'Pending' + driverResponse 'rejected'  -> REJECTED
 *       - status 'Started'                               -> IN_TRANSIT
 *       - status 'Completed'                              -> COMPLETED
 *  2. Recomputes the GeoJSON `geo` mirror on startLocation/endLocation for
 *     every shipment (the pre-validate hook that keeps it in sync only
 *     fires on save/validate, not on documents that already existed).
 *  3. Backfills Shipment.device from Vehicle.deviceId -> Device.deviceName
 *     where missing.
 *  4. Backfills Vehicle.vendor / Vehicle.device and Device.vehicle
 *     back-references from Vendor.vehicles and Vehicle.deviceId.
 *
 * What it deliberately does NOT do:
 *  - Does not touch Shipment.driverSalary — there is no reliable 1:1
 *    mapping from a shipment back to a specific entry in the driver's
 *    Driver.work[] array (a driver can have multiple overlapping-looking
 *    work entries), so backfilling it risks assigning the wrong salary.
 *    It stays null on migrated documents; only new shipments set it.
 *  - Does not touch the orphaned `Results` collection (7 docs, no
 *    matching Mongoose model in this codebase) — outside Stage 4 scope,
 *    flagged in the Stage 4 report instead.
 *  - Does not rename the physical 'Export' collection to 'Shipment'.
 *
 * Safety:
 *  - Every write is scoped to documents that still need it (idempotent —
 *    safe to re-run).
 *  - Nothing is deleted except the retired driverResponse field.
 *
 * Run with: node scripts/migrateStage4.js
 */
const mongoose = require('mongoose');
require('dotenv').config();

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  const db = mongoose.connection.db;
  const exportCol = db.collection('Export');
  const vehicleCol = db.collection('Vehicle');
  const deviceCol = db.collection('Device');
  const vendorCol = db.collection('Vendor');

  // ── 1 & 2: Export status collapse + geo mirror ──────────────────────
  const exports = await exportCol.find({}).toArray();
  let statusMigrated = 0;
  let geoBackfilled = 0;

  for (const exp of exports) {
    const update = {};
    const unset = {};

    if (typeof exp.status === 'string' && !['CREATED', 'ASSIGNED', 'ACCEPTED', 'IN_TRANSIT', 'COMPLETED', 'REJECTED', 'CANCELLED'].includes(exp.status)) {
      if (exp.status === 'Pending') {
        if (exp.driverResponse === 'accepted') update.status = 'ACCEPTED';
        else if (exp.driverResponse === 'rejected') update.status = 'REJECTED';
        else update.status = 'ASSIGNED';
      } else if (exp.status === 'Started') {
        update.status = 'IN_TRANSIT';
      } else if (exp.status === 'Completed') {
        update.status = 'COMPLETED';
      }
    }
    if ('driverResponse' in exp) {
      unset.driverResponse = '';
    }

    for (const field of ['startLocation', 'endLocation']) {
      const loc = exp[field];
      if (loc && typeof loc.latitude === 'number' && typeof loc.longitude === 'number' && !loc.geo?.coordinates) {
        update[`${field}.geo`] = { type: 'Point', coordinates: [loc.longitude, loc.latitude] };
        geoBackfilled++;
      }
    }

    if (exp.device === undefined) {
      const vehicle = await vehicleCol.findOne({ _id: exp.vehicle });
      const device = vehicle?.deviceId ? await deviceCol.findOne({ deviceName: vehicle.deviceId }) : null;
      update.device = device?._id || null;
    }

    const setOps = { ...update };
    const opts = {};
    if (Object.keys(setOps).length > 0) opts.$set = setOps;
    if (Object.keys(unset).length > 0) opts.$unset = unset;

    if (Object.keys(opts).length > 0) {
      await exportCol.updateOne({ _id: exp._id }, opts);
      if (update.status) statusMigrated++;
    }
  }
  console.log(`📦 Export: ${statusMigrated} status values migrated, geo mirror backfilled on ${geoBackfilled} location fields`);

  // ── 3 & 4: Vehicle/Device back-references ───────────────────────────
  const vendors = await vendorCol.find({}).toArray();
  let vehicleBackrefs = 0;
  for (const vendor of vendors) {
    for (const vehicleId of vendor.vehicles || []) {
      const vehicle = await vehicleCol.findOne({ _id: vehicleId });
      if (!vehicle) continue;

      const vehicleUpdate = {};
      if (vehicle.vendor === undefined || vehicle.vendor === null) {
        vehicleUpdate.vendor = vendor._id;
      }
      let deviceDoc = null;
      if ((vehicle.device === undefined || vehicle.device === null) && vehicle.deviceId) {
        deviceDoc = await deviceCol.findOne({ deviceName: vehicle.deviceId });
        if (deviceDoc) vehicleUpdate.device = deviceDoc._id;
      }
      if (Object.keys(vehicleUpdate).length > 0) {
        await vehicleCol.updateOne({ _id: vehicle._id }, { $set: vehicleUpdate });
        vehicleBackrefs++;
      }
      if (deviceDoc && (deviceDoc.vehicle === undefined || deviceDoc.vehicle === null)) {
        await deviceCol.updateOne({ _id: deviceDoc._id }, { $set: { vehicle: vehicle._id } });
      }
    }
  }
  console.log(`🚚 Vehicle: back-references backfilled on ${vehicleBackrefs} vehicles`);

  console.log('\n✅ Stage 4 migration complete.');
  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
