import express from 'express';
import {
  getAllUsers,
  getUserById,
  createUser,
  updateUserRole,
  deleteUser,
  getSystemStats
} from '../controllers/adminController.js';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// GET /api/admin/users - Get all users
router.get('/users', getAllUsers);

// GET /api/admin/users/:id - Get user by ID
router.get('/users/:id', getUserById);

// POST /api/admin/users - Create new user
router.post('/users', createUser);

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', updateUserRole);

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', deleteUser);

// GET /api/admin/stats - Get system statistics
router.get('/stats', getSystemStats);

export default router;