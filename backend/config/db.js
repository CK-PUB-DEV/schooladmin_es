import mysql from 'mysql2';

// The live .env names the database DB_DATABASE; .env.example uses DB_NAME. Accept both,
// and keep credentials out of the code.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'es_schooladmin',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const promisePool = pool.promise();

export default promisePool;
