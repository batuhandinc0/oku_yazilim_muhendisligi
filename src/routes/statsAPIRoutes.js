import express from 'express';
import { 
  getUserStats, 
  getMonthlyMostCompleted, 
  getUserBadges, 
  getCategoryStats, 
  getAnalytics 
} from '../controllers/statsAPIController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

// GET /api/stats
router.get('/stats', authenticateToken, getUserStats);

// GET /api/stats/badges
router.get('/stats/badges', authenticateToken, getUserBadges);

// GET /api/stats/category-stats
router.get('/stats/category-stats', authenticateToken, getCategoryStats);

// GET /api/stats/analytics
router.get('/stats/analytics', authenticateToken, getAnalytics);

// GET /api/stats/monthly-most-completed
router.get('/stats/monthly-most-completed', authenticateToken, getMonthlyMostCompleted);

export default router;