import jwt from 'jsonwebtoken';
import { jwtSecret } from '../config/auth.js';
import User from '../models/User.js';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Erişim reddedildi. Token bulunamadı.'
    });
  }

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Geçersiz token'
      });
    }
    req.userId = user.id;
    req.userRole = user.role;
    next();
  });
};

export const isAdmin = async (req, res, next) => {
  try {
    // If we already have userRole from token and it's admin, proceed
    if (req.userRole === 'admin') {
      return next();
    }

    // Otherwise, check database
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Erişim reddedildi. Yönetici yetkisi gereklidir.'
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Yetki kontrolü sırasında hata oluştu'
    });
  }
};

// Alias for isAdmin to match the route usage
export const requireAdmin = isAdmin;