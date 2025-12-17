import express from 'express';
import { getCalendarData, getMonthlyStats } from '../controllers/calendarController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/calendar?year=2024&month=11
router.get('/calendar', authenticateToken, getCalendarData);

// GET /api/calendar/monthly-stats?year=2024&month=11
router.get('/calendar/monthly-stats', authenticateToken, getMonthlyStats);

export default router;