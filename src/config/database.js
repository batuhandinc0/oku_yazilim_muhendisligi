import mysql from 'mysql2';
import dotenv from 'dotenv';
dotenv.config();

// Create a connection pool to the database
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'konya42',
  database: process.env.DB_NAME || 'habit_tracker',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Get a promise-based pool connection
const promisePool = pool.promise();

// Test the connection
pool.getConnection((err, connection) => {
  if (err) {
    console.error('Database connection error:', err);
    console.error('Please check your database configuration and make sure MySQL is running.');
    return;
  }
  console.log('✅ Successfully connected to the MySQL database.');
  connection.release(); // Release the connection back to the pool
});

export default promisePool;