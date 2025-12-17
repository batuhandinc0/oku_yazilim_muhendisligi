import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitTracking from '../models/HabitTracking.js';
import UserStats from '../models/UserStats.js';

// Get all users
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll();

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar alınırken bir hata oluştu'
    });
  }
};

// Get user by ID with detailed information
export const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    // Get user info
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Get user's habits
    const habits = await Habit.findByUserId(userId);

    // Get user's completion data
    const completionData = await HabitTracking.getUserCompletionData(userId);

    res.json({
      success: true,
      data: {
        user,
        habits,
        completion_data: completionData
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgileri alınırken bir hata oluştu'
    });
  }
};

// Create new user (admin only)
export const createUser = async (req, res) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var'
      });
    }

    // Create new user
    const user = await User.create(username, email, password, role);

    res.status(201).json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı oluşturulurken bir hata oluştu'
    });
  }
};

// Update user role
export const updateUserRole = async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Update user role
    await User.updateRole(userId, role);

    res.json({
      success: true,
      message: 'Kullanıcı rolü başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı rolü güncellenirken bir hata oluştu'
    });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Check if user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Delete user (cascade will handle related data)
    await User.delete(userId);

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla silindi'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı silinirken bir hata oluştu'
    });
  }
};

// Get system statistics
export const getSystemStats = async (req, res) => {
  try {
    // Get total users count
    const totalUsers = await User.getTotalCount();

    // Get total habits count
    const totalHabits = await Habit.getTotalCount();

    // Get total completions count
    const totalCompletions = await HabitTracking.getTotalCompletions();

    // Get most active users (temporarily disabled due to database issues)
    const mostActiveUsers = [];

    res.json({
      success: true,
      data: {
        total_users: totalUsers,
        total_habits: totalHabits,
        total_completions: totalCompletions,
        most_active_users: mostActiveUsers
      }
    });
  } catch (error) {
    console.error('Get system stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Sistem istatistikleri alınırken bir hata oluştu: ' + error.message
    });
  }
};
