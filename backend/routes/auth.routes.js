import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { changeUsername, changePassword } from '../controllers/userController.js';
import db from '../config/db.js';

const router = express.Router();

// GET /api/auth/verify - Verify if token is valid
router.get('/verify', verifyToken, (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Token is valid',
    data: {
      user: req.user
    }
  });
});

// GET /api/auth/me - Get current user data with assigned schools
router.get('/me', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user data
    const [users] = await db.query(
      `SELECT u.id, u.user_id, u.username, u.role, u.created_at, u.updated_at
       FROM users u
       WHERE u.id = ?`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Get user's assigned schools (only for admin users)
    let schools = [];
    if (users[0].role === 'admin') {
      const [schoolsData] = await db.query(
        `SELECT s.id, s.school_name, s.abbrv, s.image_logo, s.address, s.finance_v1, s.app_url, s.db_host, s.db_port, s.db_name, s.db_username, s.db_password
         FROM schools s
         INNER JOIN user_schools us ON s.id = us.school_id
         WHERE us.user_id = ?`,
        [userId]
      );
      schools = schoolsData;
    }

    res.status(200).json({
      status: 'success',
      data: {
        ...users[0],
        schools,
      },
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch user data',
    });
  }
});

// POST /api/auth/logout - Logout user
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
});

// PUT /api/auth/change-username - Change username
router.put('/change-username', verifyToken, changeUsername);

// PUT /api/auth/change-password - Change password
router.put('/change-password', verifyToken, changePassword);

// Global auth routes (can be used by any user type)
// Add more global auth routes here (e.g., password reset, email verification, etc.)

export default router;
