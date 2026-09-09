require('dotenv').config();
const readline = require('readline');
const AdminService = require('../services/adminService');
const { initializeDatabase } = require('../config/database');

function askQuestion(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function main() {
  await initializeDatabase();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    console.log('=== EdFilms Admin Creation ===');

    const username = await askQuestion(rl, 'Enter admin username: ');
    if (!username.trim()) {
      console.error('Username cannot be empty');
      process.exit(1);
    }

    const password = await askQuestion(rl, 'Enter admin password: ');
    if (password.length < 6) {
      console.error('Password must be at least 6 characters');
      process.exit(1);
    }

    const confirmPassword = await askQuestion(rl, 'Confirm admin password: ');
    if (password !== confirmPassword) {
      console.error('Passwords do not match');
      process.exit(1);
    }

    const admin = await AdminService.createAdmin(username.trim(), password);
    console.log(`Admin created successfully`);
    console.log(`Username: ${admin.username}`);

  } catch (error) {
    console.error(`Failed to create admin: ${error.message}`);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();