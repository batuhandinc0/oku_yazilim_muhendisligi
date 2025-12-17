import express from 'express';
import { adminLogin, getAdminProfile } from '../controllers/adminAuthController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// Admin login route (no authentication required)
router.post('/login', adminLogin);

// Admin profile route (authentication required)
router.get('/profile', authenticateToken, getAdminProfile);

export default router;