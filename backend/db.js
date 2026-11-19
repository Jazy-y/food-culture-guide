const mysql = require('mysql');

// Connection settings come from the environment; see backend/README.md.
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'food_culture_guide',
});

db.connect((err) => {
  if (err) throw err;
  console.log('MySQL connected...');
});

module.exports = db;
