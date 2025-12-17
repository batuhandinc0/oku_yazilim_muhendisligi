import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

// Import routes
import authRoutes from './routes/authRoutes.js';
import habitRoutes from './routes/habitRoutes.js';
import statsAPIRoutes from './routes/statsAPIRoutes.js';
import calendarRoutes from './routes/calendarRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import adminAuthRoutes from './routes/adminAuthRoutes.js';

// Load environment variables
dotenv.config();

// Set default JWT secret if not provided
if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'your_super_secret_jwt_key_here_change_this_in_production';
    console.warn('⚠️  JWT_SECRET not found in environment variables. Using default secret. Please set JWT_SECRET in your .env file for production!');
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/habits', habitRoutes);
app.use('/api', statsAPIRoutes);
app.use('/api', calendarRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin', adminRoutes);

// Serve main application
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/homepage/index.html'));
});

// Serve user panel
app.get('/user/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/user/index.html'));
});

// Serve admin panel (admins will login through regular login and be redirected)
app.get('/admin/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
    console.log(`📱 Open http://localhost:${PORT} in your browser`);
});

export default app;