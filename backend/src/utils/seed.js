require('dotenv').config();
const { initializeDatabase } = require('../config/database');

async function main() {
  try {
    await initializeDatabase();
    console.log('Default categories seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error.message);
    process.exit(1);
  }
}

main();