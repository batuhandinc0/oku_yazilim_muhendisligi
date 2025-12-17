import bcrypt from 'bcryptjs';
import db from '../config/database.js';

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user...');
    
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin42';
    const adminUsername = 'Admin';
    
    // Check if admin already exists
    const [existingUsers] = await db.execute(
      'SELECT id FROM users WHERE email = ?',
      [adminEmail]
    );
    
    if (existingUsers.length > 0) {
      console.log('⚠️ Admin user already exists!');
      
      // Update password if needed
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await db.execute(
        'UPDATE users SET password = ?, role = "admin", username = ? WHERE email = ?',
        [hashedPassword, adminUsername, adminEmail]
      );
      
      console.log('✅ Admin user updated successfully!');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      return;
    }
    
    // Create new admin user
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    // Use connection pool
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();
      
      // Insert admin user
      const [result] = await connection.execute(
        'INSERT INTO users (username, email, password, role) VALUES (?, ?, ?, ?)',
        [adminUsername, adminEmail, hashedPassword, 'admin']
      );
      
      // Initialize user stats
      await connection.execute(
        'INSERT INTO user_stats (user_id, total_points, level) VALUES (?, 0, 1)',
        [result.insertId]
      );
      
      await connection.commit();
      connection.release();
      
      console.log('✅ Admin user created successfully!');
      console.log(`📧 Email: ${adminEmail}`);
      console.log(`🔑 Password: ${adminPassword}`);
      console.log(`🆔 User ID: ${result.insertId}`);
      
    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
    process.exit(1);
  }
}

// Run the function
createAdminUser().then(() => {
  console.log('🎉 Admin user setup completed!');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});