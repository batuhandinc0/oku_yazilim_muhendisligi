// JWT secret - should be set in environment variables in production
export const jwtSecret = process.env.JWT_SECRET || 'your_super_secret_jwt_key_here_change_this_in_production';

export default {
  jwtSecret
};