import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { jwtSecret } from '../config/auth.js';

// Admin login - only allows admin@gmail.com
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Only allow admin@gmail.com to login
    if (email !== 'admin@gmail.com') {
      return res.status(403).json({
        success: false,
        message: 'Bu alana sadece yetkili yönetici erişebilir'
      });
    }

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz e-posta veya şifre'
      });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu alana sadece yöneticiler erişebilir'
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

    // Generate JWT token with admin flag
    const token = jwt.sign({ 
      id: user.id, 
      role: user.role, 
      email: user.email,
      isAdmin: true 
    }, jwtSecret, { expiresIn: '24h' });

    res.json({
      success: true,
      message: 'Yönetici girişi başarılı',
      data: { 
        token, 
        user: { 
          id: user.id, 
          username: user.username, 
          email: user.email, 
          role: user.role 
        } 
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu'
    });
  }
};

// Get admin profile
export const getAdminProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Only allow admin@gmail.com to access admin panel
    if (user.email !== 'admin@gmail.com' || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu alana sadece yetkili yönetici erişebilir'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Admin profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Profil bilgisi alınırken bir hata oluştu'
    });
  }
};