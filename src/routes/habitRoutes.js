import express from 'express';
import {
  createHabit,
  getHabits,
  updateHabit,
  deleteHabit,
  markHabitComplete
} from '../controllers/habitController.js';
import { authenticateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateToken, createHabit);
router.get('/', authenticateToken, getHabits);
router.put('/:id', authenticateToken, updateHabit);
router.delete('/:id', authenticateToken, deleteHabit);
router.post('/:id/complete', authenticateToken, markHabitComplete);

export default router;