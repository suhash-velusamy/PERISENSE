/**
 * Password Migration Script
 * Updates all users with hashed password "Password@123"
 * 
 * Run with: node scripts/migratePasswords.js
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const Customer = require('../models/customerModel');
const Vendor = require('../models/vendorModel');
const Driver = require('../models/driverModel');

const NEW_PASSWORD = 'Password@123';

async function migratePasswords() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(NEW_PASSWORD, salt);
        console.log('🔐 Password hashed:', hashedPassword.substring(0, 20) + '...');

        // Update all Customers
        const customerResult = await Customer.updateMany(
            {},
            { $set: { password: hashedPassword } }
        );
        console.log(`👤 Updated ${customerResult.modifiedCount} customers`);

        // Update all Vendors
        const vendorResult = await Vendor.updateMany(
            {},
            { $set: { password: hashedPassword } }
        );
        console.log(`🏪 Updated ${vendorResult.modifiedCount} vendors`);

        // Update all Drivers
        const driverResult = await Driver.updateMany(
            {},
            { $set: { password: hashedPassword } }
        );
        console.log(`🚚 Updated ${driverResult.modifiedCount} drivers`);

        console.log('\n✅ Password migration complete!');
        console.log(`📋 All users now have password: ${NEW_PASSWORD}`);

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

migratePasswords();
