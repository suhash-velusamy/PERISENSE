/**
 * Service Request Routes
 * API endpoints for managing vendor service requests
 */
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ServiceRequest = require('../models/serviceRequestModel');
const { authorize } = require('../middleware/auth');

/**
 * GET /api/vendor/service-requests/:vendorId
 * Get all service requests for a vendor (vendor may only read their own)
 */
router.get('/service-requests/:vendorId', authorize('Vendor'), async (req, res) => {
    try {
        const { vendorId } = req.params;

        if (vendorId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your service requests.' });
        }

        const requests = await ServiceRequest.find({ vendor: vendorId })
            .populate('customer', 'name email phone')
            .sort({ createdAt: -1 });

        res.json(requests);
    } catch (error) {
        console.error('Error fetching service requests:', error);
        res.status(500).json({ error: 'Failed to fetch service requests' });
    }
});

/**
 * POST /api/vendor/service-requests
 * Create a new service request (from an authenticated customer)
 */
router.post('/service-requests', authorize('Customer'), async (req, res) => {
    try {
        const { vendorId, serviceType, message } = req.body;

        if (!vendorId || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!mongoose.isValidObjectId(vendorId)) {
            return res.status(400).json({ error: 'Invalid vendorId' });
        }

        const request = new ServiceRequest({
            // customer identity comes from the verified JWT, never from the client body
            customer: req.user.id,
            vendor: vendorId,
            serviceType: serviceType || 'other',
            message,
        });

        await request.save();

        res.status(201).json({
            success: true,
            message: 'Service request created successfully',
            request,
        });
    } catch (error) {
        console.error('Error creating service request:', error);
        res.status(500).json({ error: 'Failed to create service request' });
    }
});

/**
 * PUT /api/vendor/service-requests/:requestId/accept
 * Accept a service request (only the owning vendor)
 */
router.put('/service-requests/:requestId/accept', authorize('Vendor'), async (req, res) => {
    try {
        const { requestId } = req.params;

        const existing = await ServiceRequest.findById(requestId);
        if (!existing) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (existing.vendor.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your service request.' });
        }

        existing.status = 'accepted';
        existing.updatedAt = Date.now();
        await existing.save();
        await existing.populate('customer', 'name email');

        res.json({
            success: true,
            message: 'Request accepted',
            request: existing,
        });
    } catch (error) {
        console.error('Error accepting request:', error);
        res.status(500).json({ error: 'Failed to accept request' });
    }
});

/**
 * PUT /api/vendor/service-requests/:requestId/reject
 * Reject a service request (only the owning vendor)
 */
router.put('/service-requests/:requestId/reject', authorize('Vendor'), async (req, res) => {
    try {
        const { requestId } = req.params;
        const { reason } = req.body;

        const existing = await ServiceRequest.findById(requestId);
        if (!existing) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (existing.vendor.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your service request.' });
        }

        existing.status = 'rejected';
        existing.response = reason || '';
        existing.updatedAt = Date.now();
        await existing.save();
        await existing.populate('customer', 'name email');

        res.json({
            success: true,
            message: 'Request rejected',
            request: existing,
        });
    } catch (error) {
        console.error('Error rejecting request:', error);
        res.status(500).json({ error: 'Failed to reject request' });
    }
});

/**
 * PUT /api/vendor/service-requests/:requestId/complete
 * Mark a service request as completed (only the owning vendor)
 */
router.put('/service-requests/:requestId/complete', authorize('Vendor'), async (req, res) => {
    try {
        const { requestId } = req.params;
        const { response } = req.body;

        const existing = await ServiceRequest.findById(requestId);
        if (!existing) {
            return res.status(404).json({ error: 'Request not found' });
        }
        if (existing.vendor.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Access denied. Not your service request.' });
        }

        existing.status = 'completed';
        existing.response = response || '';
        existing.updatedAt = Date.now();
        await existing.save();

        res.json({
            success: true,
            message: 'Request completed',
            request: existing,
        });
    } catch (error) {
        console.error('Error completing request:', error);
        res.status(500).json({ error: 'Failed to complete request' });
    }
});

module.exports = router;
