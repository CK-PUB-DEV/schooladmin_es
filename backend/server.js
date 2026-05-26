import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import superAdminRoutes from './routes/super-admin.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = 'https://schooladmin.essentiel.ph';

// CORS configuration
const corsOptions = {
  origin: CORS_ORIGIN,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
};

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Apply CORS to all routes
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend server is running' });
});

app.get('/api', (req, res) => {
  res.json({ message: 'Welcome to the API' });
});

app.get('/api/db-test', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT 1 + 1 AS result');
    res.json({
      status: 'success',
      message: 'Database connection successful',
      result: rows[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Temporary diagnostic route — no auth, GET, open in browser
// Usage: /api/ar-test?host=139.180.143.50&port=3306&db=esrpci&user=root&pass=&syid=1&semid=1
app.get('/api/ar-test', async (req, res) => {
  const mysql = (await import('mysql2/promise')).default;
  const { host, port, db: dbName, user, pass, syid, semid } = req.query;
  if (!host || !dbName || !syid) {
    return res.json({ error: 'Required: host, db, syid' });
  }
  const t0 = Date.now();
  let conn;
  try {
    conn = await mysql.createConnection({
      host, port: Number(port) || 3306, database: dbName,
      user: user || 'root', password: pass || '',
      connectTimeout: 15000,
    });
    const tConn = Date.now();
    const params = [syid];
    const where = ['syid = ?'];
    if (semid) { where.push('semid IN (0, ?)'); params.push(semid); }
    const [[row]] = await conn.execute(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(total_payables),0) AS tp FROM student_transactions WHERE ${where.join(' AND ')}`,
      params
    );
    const tQuery = Date.now();
    res.json({
      connect_ms: tConn - t0,
      query_ms:   tQuery - tConn,
      total_ms:   tQuery - t0,
      count:      row.cnt,
      total_payables: row.tp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message, elapsed_ms: Date.now() - t0 });
  } finally {
    if (conn) await conn.end().catch(() => {});
  }
});

const startServer = async () => {
  try {
    await db.query('SELECT 1');
    console.log('Database connected successfully');

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

startServer();
