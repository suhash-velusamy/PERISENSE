/**
 * Password Reset Routes
 * OTP-based password reset flow
 */
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Customer = require('../models/customerModel');
const Vendor = require('../models/vendorModel');
const Driver = require('../models/driverModel');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// OTP expiry time (10 minutes)
const OTP_EXPIRY = 10 * 60 * 1000;

/**
 * Generate 6-digit OTP
 */
function generateOTP() {
    return crypto.randomInt(100000, 999999).toString();
}

/**
 * Get model by role
 */
function getModelByRole(role) {
    switch (role?.toLowerCase()) {
        case 'vendor': return Vendor;
        case 'driver': return Driver;
        default: return Customer;
    }
}

/**
 * POST /api/forgot-password
 * Request password reset OTP
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        const Model = getModelByRole(role);
        const user = await Model.findOne({ email: email.toLowerCase() });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'No account found with this email'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiry = Date.now() + OTP_EXPIRY;

        // Store OTP with email as key
        otpStore.set(email.toLowerCase(), {
            otp,
            expiry,
            role,
            userId: user._id,
            attempts: 0,
        });

        // In production, send OTP via email/SMS
        console.log(`🔐 OTP for ${email}: ${otp}`);

        res.json({
            success: true,
            message: 'OTP sent successfully. Check your email.',
            // Include OTP in dev mode only (remove in production)
            devOtp: process.env.NODE_ENV === 'development' ? otp : undefined,
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request'
        });
    }
});

/**
 * POST /api/verify-otp
 * Verify OTP code
 */
router.post('/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Email and OTP are required'
            });
        }

        const stored = otpStore.get(email.toLowerCase());

        if (!stored) {
            return res.status(400).json({
                success: false,
                message: 'No OTP request found. Please request a new one.'
            });
        }

        // Check expiry
        if (Date.now() > stored.expiry) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'OTP has expired. Please request a new one.'
            });
        }

        // Check attempts
        if (stored.attempts >= 3) {
            otpStore.delete(email.toLowerCase());
            return res.status(400).json({
                success: false,
                message: 'Too many attempts. Please request a new OTP.'
            });
        }

        // Verify OTP
        if (stored.otp !== otp) {
            stored.attempts++;
            return res.status(400).json({
                success: false,
                message: `Invalid OTP. ${3 - stored.attempts} attempts remaining.`
            });
        }

        // OTP verified - generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        stored.resetToken = resetToken;
        stored.verified = true;

        res.json({
            success: true,
            message: 'OTP verified successfully',
            resetToken,
        });
    } catch (error) {
        console.error('Verify OTP error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify OTP'
        });
    }
});

/**
 * POST /api/reset-password
 * Reset password with new password
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;

        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields are required'
            });
        }

        // Password validation
        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters'
            });
        }

        const stored = otpStore.get(email.toLowerCase());

        if (!stored || !stored.verified || stored.resetToken !== resetToken) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Update password. findByIdAndUpdate would bypass each model's
        // pre('save') bcrypt hook and write newPassword in plaintext — load
        // the document and save() instead so it hashes exactly like every
        // other password write in this codebase.
        const Model = getModelByRole(stored.role);
        const user = await Model.findById(stored.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Account not found'
            });
        }
        user.password = newPassword;
        await user.save();

        // Clear OTP store
        otpStore.delete(email.toLowerCase());

        res.json({
            success: true,
            message: 'Password reset successfully. Please login with your new password.',
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

module.exports = router;
