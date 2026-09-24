const express = require('express');
const connectDB = require('./db');
const signupRoute = require('./routes/signupRoute');
const loginRoute = require('./routes/loginRoute');
const errorHandler = require('./middleware/errorHandler');
const { authMiddleware, authorize } = require('./middleware/auth');

require('dotenv').config();
const app = express();

// Connect to MongoDB
connectDB();

// Middleware to parse JSON
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Health check (no auth required, does not expose sensitive info)
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    uptime: process.uptime(),
  });
});

// ── Public routes (no authentication required) ──────────────────────
app.use('/api', signupRoute);
app.use('/api', loginRoute);
app.use('/api', require('./routes/passwordReset'));

// ── Protected routes ─────────────────────────────────────────────────
// Every route below this point requires a valid JWT. Role is additionally
// enforced per route-group; fine-grained resource-ownership checks live
// inside the individual route handlers.
//
// NOTE: vendorRoutes and serviceRequestRoutes are both mounted at
// '/api/vendor'. Order matters here: an Express Router with no matching
// route for the current path automatically falls through to the next
// middleware — but a router.use() role gate inside a router still runs for
// every request that reaches that router, before that router even checks
// whether it has a matching path. Mounting serviceRequestRoutes FIRST means
// its own paths (including the Customer-only create endpoint) are fully
// handled by its own per-route authorize() calls without ever reaching
// vendorRoutes' blanket authorize('Vendor'). Any path serviceRequestRoutes
// doesn't recognize (e.g. /all, /exports/...) falls through to vendorRoutes,
// where router.use(authorize('Vendor')) then correctly applies.
app.use('/api/vendor', authMiddleware, require('./routes/serviceRequestRoutes'));
app.use('/api/vendor', authMiddleware, require('./routes/vendorRoutes'));
app.use('/api/driver', authMiddleware, authorize('Driver'), require('./routes/driverRoutes'));
app.use('/api/customer', authMiddleware, authorize('Customer'), require('./routes/customerRoutes'));
// Chat is shared by all three roles (customer<->vendor, driver<->vendor)
app.use('/chat', authMiddleware, require('./routes/chat'));
// Any authenticated user may register their own push token
app.use('/api/user', authMiddleware, require('./routes/user'));

// Global error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
