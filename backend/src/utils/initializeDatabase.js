require('dotenv').config();
const { initializeDatabase, DATABASE_URL } = require('../config/database');

async function main() {
  try {
    await initializeDatabase();
    console.log('Database initialized successfully');
    console.log(`Database: ${DATABASE_URL}`);
    console.log('Tables created, indexes created, default categories seeded');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    process.exit(1);
  }
}

main();