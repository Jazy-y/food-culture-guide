#!/usr/bin/env node

/**
 * Script to deploy Firebase indexes
 * 
 * Usage:
 * node scripts/deploy-indexes.js
 */

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Pretty log functions
const log = {
  info: (message) => console.log(`${colors.blue}[INFO]${colors.reset} ${message}`),
  success: (message) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${message}`),
  error: (message) => console.log(`${colors.red}[ERROR]${colors.reset} ${message}`),
  warn: (message) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${message}`),
};

// Check if firebase.json exists
const checkFirebaseConfig = () => {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase.json');
  if (!fs.existsSync(firebaseConfigPath)) {
    log.error('firebase.json not found in the current directory');
    return false;
  }
  return true;
};

// Check if firestore.indexes.json exists
const checkFirestoreIndexes = () => {
  const indexesPath = path.join(process.cwd(), 'firestore.indexes.json');
  if (!fs.existsSync(indexesPath)) {
    log.error('firestore.indexes.json not found in the current directory');
    return false;
  }
  return true;
};

// Deploy Firebase indexes
const deployIndexes = () => {
  log.info('Deploying Firestore indexes...');

  return new Promise((resolve, reject) => {
    const command = 'firebase deploy --only firestore:indexes';
    
    const deployment = exec(command);
    
    deployment.stdout.on('data', (data) => {
      console.log(data.toString());
    });
    
    deployment.stderr.on('data', (data) => {
      console.error(data.toString());
    });
    
    deployment.on('close', (code) => {
      if (code === 0) {
        log.success('Firestore indexes deployed successfully');
        resolve();
      } else {
        log.error(`Deployment failed with code ${code}`);
        reject(new Error(`Deployment failed with code ${code}`));
      }
    });
  });
};

// Main function
const main = async () => {
  log.info('Starting Firebase indexes deployment...');
  
  if (!checkFirebaseConfig() || !checkFirestoreIndexes()) {
    process.exit(1);
  }
  
  try {
    await deployIndexes();
    log.info('The indexes may take a few minutes to build and become available.');
    log.info('You can check their status in the Firebase console.');
  } catch (error) {
    log.error(`Failed to deploy indexes: ${error.message}`);
    process.exit(1);
  }
};

// Execute main function
main(); 