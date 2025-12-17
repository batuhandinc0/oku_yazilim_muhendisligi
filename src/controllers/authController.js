import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { jwtSecret } from '../config/auth.js';

// Register a new user
export const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu e-posta adresiyle kayıtlı bir kullanıcı zaten var'
      });
    }

    // Create new user (default role is 'user')
    const user = await User.create(username, email, password);

    // Generate JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '24h' });

    res.status(201).json({
      success: true,
      message: 'Kullanıcı başarıyla oluşturuldu',
      data: { token, user: { id: user.id, username: user.username, email: user.email, role: user.role } }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Kayıt sırasında bir hata oluştu'
    });
  }
};

// Login user
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta veya şifre'
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta veya şifre'
      });
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, role: user.role }, jwtSecret, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Giriş başarılı',
      data: { token, user: { id: user.id, username: user.username, email: user.email, role: user.role } }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu'
    });
  }
};

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Profil bilgisi alınırken bir hata oluştu'
    });
  }
};


// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const userId = req.userId;

    // Check if new email is already taken by another user
    if (email) {
      const existingUser = await User.findByEmail(email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({
          success: false,
          message: 'Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor'
        });
      }
    }

    await User.update(userId, username, email, password);

    res.json({
      success: true,
      message: 'Profil bilgileriniz başarıyla güncellendi'
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Profil güncellenirken bir hata oluştu'
    });
  }
};