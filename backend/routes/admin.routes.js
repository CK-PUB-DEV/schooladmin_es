import express from 'express';
import {
  getAllEmployees,
  getEmployeeById,
  getUserTypes,
} from '../controllers/employeeController.js';
import { getEmployeeAttendance } from '../controllers/employeeAttendanceController.js';
import { getDashboardData } from '../controllers/dashboardController.js';
import {
  getAllMemos,
  getMemoById,
  createMemo,
  updateMemo,
  deleteMemo,
} from '../controllers/memoController.js';
import {
  getEnrollmentSummary,
  getEnrollmentList,
  getSchoolYears,
  getSemesters,
} from '../controllers/enrollmentController.js';
import {
  getCashierSummary,
  getTransactionList,
  getPaymentTypes,
  getTerminals,
} from '../controllers/cashierController.js';
import {
  getAccountReceivableFilters,
  getAccountReceivableList,
  getAccountReceivableSummary,
  getAccountReceivableTransactions,
} from '../controllers/accountReceivablesController.js';
import {
  getDailyCashSummary,
  getDailyCashItems,
} from '../controllers/dailyCashProgressController.js';
import { getSchoolCalendarEvents } from '../controllers/calendarController.js';
import {
  getMonthlySummary,
  getMonthlySummaryItems,
  getYearlySummary,
  getYearlySummaryTable,
} from '../controllers/summaryController.js';
import {
  getAccountReceivableFilters as getFinanceV1ReceivableFilters,
  getAccountReceivableSections as getFinanceV1ReceivableSections,
  getAccountReceivableSummary as getFinanceV1ReceivableSummary,
  getAccountReceivableList as getFinanceV1ReceivableList,
  getCashierSummary as getFinanceV1CashierSummary,
  getTransactionList as getFinanceV1TransactionList,
  getPaymentTypes as getFinanceV1PaymentTypes,
  getTerminals as getFinanceV1Terminals,
  getDailyCashSummary as getFinanceV1DailyCashSummary,
  getDailyCashItems as getFinanceV1DailyCashItems,
  getMonthlySummary as getFinanceV1MonthlySummary,
  getMonthlySummaryItems as getFinanceV1MonthlySummaryItems,
  getYearlySummary as getFinanceV1YearlySummary,
  getYearlySummaryTable as getFinanceV1YearlySummaryTable,
} from '../controllers/financeV1Controller.js';
import {
  getStudentLedgerFilters,
  getStudentLedgerList,
  getStudentLedger,
} from '../controllers/studentLedgerController.js';
import { verifyToken } from '../middleware/auth.js';
import { attachSchool } from '../middleware/school.js';
import {
  getCashierSummaryV2,
  getTransactionListV2,
  getPaymentTypesV2,
  getTerminalsV2,
  getDailyCashSummaryV2,
  getDailyCashItemsV2,
} from '../controllers/v2/collections.js';
import {
  getReceivableFiltersV2,
  getReceivableSummaryV2,
  getReceivableListV2,
} from '../controllers/v2/receivables.js';
import {
  getMonthlySummaryV2,
  getMonthlySummaryItemsV2,
  getYearlySummaryV2,
  getYearlySummaryTableV2,
} from '../controllers/v2/summaries.js';
import {
  getEnrollmentSummaryV2,
  getEnrollmentListV2,
  getSchoolYearsV2,
  getSemestersV2,
} from '../controllers/v2/enrollment.js';
import {
  getAllEmployeesV2,
  getEmployeeByIdV2,
  getUserTypesV2,
  getEmployeeAttendanceV2,
  getSchoolCalendarEventsV2,
  getAllMemosV2,
  getMemoByIdV2,
  createMemoV2,
  updateMemoV2,
  deleteMemoV2,
} from '../controllers/v2/hrCalendarMemos.js';
import { getDashboardDataV2 } from '../controllers/v2/dashboard.js';
import { uploadMemoFile } from '../middleware/upload.js';
import db from '../config/db.js';
import mysql from 'mysql2/promise';

const router = express.Router();

// Every admin route: logged in, and the school resolved server-side (school id or
// db_name from the page; database credentials never come from the browser).
router.use(verifyToken, attachSchool);

const getSchoolConnection = async (schoolDbConfig) => {
  const parsedPort = Number.parseInt(schoolDbConfig.db_port, 10);
  const resolvedPort = Number.isNaN(parsedPort)
    ? Number.parseInt(process.env.DB_PORT, 10) || 3306
    : parsedPort;
  const connection = await mysql.createConnection({
    host: schoolDbConfig.db_host || process.env.DB_HOST || 'localhost',
    user: schoolDbConfig.db_username,
    password: schoolDbConfig.db_password || '',
    database: schoolDbConfig.db_name,
    port: resolvedPort,
  });
  return connection;
};

const probeFinanceV1BySchema = async (schoolDbConfig) => {
  let schoolDb;
  try {
    schoolDb = await getSchoolConnection(schoolDbConfig);
    const [columnRows] = await schoolDb.execute(
      `SELECT COUNT(*) as count
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'chrngtrans'
         AND COLUMN_NAME = 'change_amount'`,
      [schoolDbConfig.db_name]
    );
    return Number(columnRows?.[0]?.count || 0) === 0;
  } catch (schemaError) {
    console.error('Error probing school DB schema:', schemaError);
    return false;
  } finally {
    if (schoolDb) {
      await schoolDb.end();
    }
  }
};

const resolveFinanceV1 = async (schoolDbConfig) => {
  if (!schoolDbConfig?.db_name) {
    return false;
  }

  if (schoolDbConfig.finance_v1 !== undefined && schoolDbConfig.finance_v1 !== null) {
    return Number(schoolDbConfig.finance_v1) === 1;
  }

  try {
    const [rows] = await db.query(
      'SELECT finance_v1 FROM schools WHERE db_name = ? LIMIT 1',
      [schoolDbConfig.db_name]
    );
    if (!rows || rows.length === 0) {
      return await probeFinanceV1BySchema(schoolDbConfig);
    }
    return Number(rows[0].finance_v1) === 1;
  } catch (error) {
    console.error('Error resolving finance_v1 flag:', error);
    return await probeFinanceV1BySchema(schoolDbConfig);
  }
};

const routeFinance = (v2Handler, v1Handler) => async (req, res, next) => {
  if (!v1Handler) {
    return v2Handler(req, res, next);
  }

  const isFinanceV1 = await resolveFinanceV1(req.body?.schoolDbConfig);
  if (isFinanceV1) {
    return v1Handler(req, res, next);
  }

  return v2Handler(req, res, next);
};

// Modules outside Finance: a Finance V2 school is read through its own app (API key);
// a Finance V1 school keeps its direct database handler.
const bySchool = (v2Handler, v1Handler) => (req, res, next) =>
  req.school && Number(req.school.finance_v1) !== 1 ? v2Handler(req, res, next) : v1Handler(req, res, next);

// Dashboard Routes (all require authentication)
// POST /api/admin/dashboard - Get comprehensive dashboard data
router.post('/dashboard', verifyToken, bySchool(getDashboardDataV2, getDashboardData));

// Employee Profile Routes (all require authentication)
// POST /api/admin/employees - Get all employees (POST to send school db config)
router.post('/employees', verifyToken, bySchool(getAllEmployeesV2, getAllEmployees));

// POST /api/admin/employees/:id - Get single employee (POST to send school db config)
router.post('/employees/:id', verifyToken, bySchool(getEmployeeByIdV2, getEmployeeById));

// POST /api/admin/user-types - Get all user types (POST to send school db config)
router.post('/user-types', verifyToken, bySchool(getUserTypesV2, getUserTypes));

// Employee Attendance Routes (all require authentication)
// POST /api/admin/employee-attendance - Get employee attendance records
router.post('/employee-attendance', verifyToken, bySchool(getEmployeeAttendanceV2, getEmployeeAttendance));

// Memo Board Routes (all require authentication)
// POST /api/admin/memos - Get all memos
router.post('/memos', verifyToken, bySchool(getAllMemosV2, getAllMemos));

// POST /api/admin/memos/upload-file - Upload memo file
router.post('/memos/upload-file', verifyToken, (req, res) => {
  uploadMemoFile.single('file')(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);

      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          status: 'error',
          message: 'File size too large. Maximum size is 10MB.',
        });
      }

      return res.status(400).json({
        status: 'error',
        message: err.message || 'Failed to upload file',
      });
    }

    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded',
      });
    }

    // Construct full S3 URL with protocol
    const fileUrl = req.file.location.startsWith('http')
      ? req.file.location
      : `https://${req.file.location}`;

    // Return the S3 URL
    res.status(200).json({
      status: 'success',
      message: 'File uploaded successfully',
      data: {
        fileUrl: fileUrl,
        fileName: req.file.key,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
      },
    });
  });
});

// POST /api/admin/memos/create - Create new memo (must be before /:id route)
router.post('/memos/create', verifyToken, bySchool(createMemoV2, createMemo));

// POST /api/admin/memos/:id - Get single memo
router.post('/memos/:id', verifyToken, bySchool(getMemoByIdV2, getMemoById));

// PUT /api/admin/memos/:id - Update memo
router.put('/memos/:id', verifyToken, bySchool(updateMemoV2, updateMemo));

// DELETE /api/admin/memos/:id - Delete memo
router.delete('/memos/:id', verifyToken, bySchool(deleteMemoV2, deleteMemo));

// Enrollment Routes (all require authentication)
// POST /api/admin/enrollment/summary - Get enrollment summary statistics
router.post('/enrollment/summary', verifyToken, bySchool(getEnrollmentSummaryV2, getEnrollmentSummary));

// POST /api/admin/enrollment/list - Get detailed enrollment list
router.post('/enrollment/list', verifyToken, bySchool(getEnrollmentListV2, getEnrollmentList));

// POST /api/admin/enrollment/school-years - Get available school years
router.post('/enrollment/school-years', verifyToken, bySchool(getSchoolYearsV2, getSchoolYears));

// POST /api/admin/enrollment/semesters - Get available semesters
router.post('/enrollment/semesters', verifyToken, bySchool(getSemestersV2, getSemesters));

// Cashier Transaction Routes (all require authentication)
// POST /api/admin/cashier/summary - Get cashier summary statistics
router.post(
  '/cashier/summary',
  verifyToken,
  routeFinance(getCashierSummaryV2, getFinanceV1CashierSummary)
);

// POST /api/admin/cashier/transactions - Get transaction list
router.post(
  '/cashier/transactions',
  verifyToken,
  routeFinance(getTransactionListV2, getFinanceV1TransactionList)
);

// POST /api/admin/cashier/payment-types - Get payment types
router.post(
  '/cashier/payment-types',
  verifyToken,
  routeFinance(getPaymentTypesV2, getFinanceV1PaymentTypes)
);

// POST /api/admin/cashier/terminals - Get terminals
router.post(
  '/cashier/terminals',
  verifyToken,
  routeFinance(getTerminalsV2, getFinanceV1Terminals)
);

// Accounts Receivable Routes (all require authentication)
// POST /api/admin/receivables/filters - Get account receivables filters
router.post(
  '/receivables/filters',
  verifyToken,
  routeFinance(getReceivableFiltersV2, getFinanceV1ReceivableFilters)
);

// POST /api/admin/receivables/summary - Get account receivables summary
router.post(
  '/receivables/summary',
  verifyToken,
  routeFinance(getReceivableSummaryV2, getFinanceV1ReceivableSummary)
);

// POST /api/admin/receivables/list - Get account receivables list
router.post(
  '/receivables/list',
  verifyToken,
  routeFinance(getReceivableListV2, getFinanceV1ReceivableList)
);

// POST /api/admin/receivables/transactions - Get student_ledger entries (V2 only, lazy tab)
// The school app has no school-wide ledger-entry list (its ledger is per student), so
// this tab is not offered for Finance V2 schools; their per-student ledgers are under Student Ledgers.
router.post('/receivables/transactions', verifyToken, (req, res) =>
  res.status(410).json({ status: 'error', message: 'Ledger entries are under Student Ledgers for this school.' })
);

// Daily Cash Progress Routes (all require authentication)
// POST /api/admin/cash-progress/summary - Get daily cash summary
router.post(
  '/cash-progress/summary',
  verifyToken,
  routeFinance(getDailyCashSummaryV2, getFinanceV1DailyCashSummary)
);

// POST /api/admin/cash-progress/items - Get daily cash items
router.post(
  '/cash-progress/items',
  verifyToken,
  routeFinance(getDailyCashItemsV2, getFinanceV1DailyCashItems)
);

// Calendar Routes (all require authentication)
// POST /api/admin/calendar/events - Get school calendar events
router.post('/calendar/events', verifyToken, bySchool(getSchoolCalendarEventsV2, getSchoolCalendarEvents));

// Monthly Summary Routes (all require authentication)
// POST /api/admin/monthly-summary/summary - Get monthly summary analytics
router.post(
  '/monthly-summary/summary',
  verifyToken,
  routeFinance(getMonthlySummaryV2, getFinanceV1MonthlySummary)
);

// POST /api/admin/monthly-summary/items - Get monthly summary items
router.post(
  '/monthly-summary/items',
  verifyToken,
  routeFinance(getMonthlySummaryItemsV2, getFinanceV1MonthlySummaryItems)
);

// Yearly Summary Routes (all require authentication)
// POST /api/admin/yearly-summary/summary - Get yearly summary analytics
router.post(
  '/yearly-summary/summary',
  verifyToken,
  routeFinance(getYearlySummaryV2, getFinanceV1YearlySummary)
);

// POST /api/admin/yearly-summary/table - Get yearly summary table data
router.post(
  '/yearly-summary/table',
  verifyToken,
  routeFinance(getYearlySummaryTableV2, getFinanceV1YearlySummaryTable)
);

// Student Ledger Routes (Finance V2 only; proxied to the school's own app via schools.app_url)
router.post('/student-ledgers/filters', verifyToken, getStudentLedgerFilters);
router.post('/student-ledgers/students', verifyToken, getStudentLedgerList);
router.post('/student-ledgers/ledger', verifyToken, getStudentLedger);

// ============================================================================
// FINANCE V1 ROUTES (for schools with finance_v1 = 1)
// ============================================================================

// Finance V1 - Accounts Receivable Routes (all require authentication)
// POST /api/admin/finance-v1/receivables/filters - Get account receivables filters
router.post('/finance-v1/receivables/filters', verifyToken, getFinanceV1ReceivableFilters);

// POST /api/admin/finance-v1/receivables/sections - Get account receivables sections
router.post('/finance-v1/receivables/sections', verifyToken, getFinanceV1ReceivableSections);

// POST /api/admin/finance-v1/receivables/summary - Get account receivables summary
router.post('/finance-v1/receivables/summary', verifyToken, getFinanceV1ReceivableSummary);

// POST /api/admin/finance-v1/receivables/list - Get account receivables list
router.post('/finance-v1/receivables/list', verifyToken, getFinanceV1ReceivableList);

// Finance V1 - Cashier Transaction Routes (all require authentication)
// POST /api/admin/finance-v1/cashier/summary - Get cashier summary statistics
router.post('/finance-v1/cashier/summary', verifyToken, getFinanceV1CashierSummary);

// POST /api/admin/finance-v1/cashier/transactions - Get transaction list
router.post('/finance-v1/cashier/transactions', verifyToken, getFinanceV1TransactionList);

// POST /api/admin/finance-v1/cashier/payment-types - Get payment types
router.post('/finance-v1/cashier/payment-types', verifyToken, getFinanceV1PaymentTypes);

// POST /api/admin/finance-v1/cashier/terminals - Get terminals
router.post('/finance-v1/cashier/terminals', verifyToken, getFinanceV1Terminals);

// Finance V1 - Daily Cash Progress Routes (all require authentication)
// POST /api/admin/finance-v1/cash-progress/summary - Get daily cash summary
router.post('/finance-v1/cash-progress/summary', verifyToken, getFinanceV1DailyCashSummary);

// POST /api/admin/finance-v1/cash-progress/items - Get daily cash items
router.post('/finance-v1/cash-progress/items', verifyToken, getFinanceV1DailyCashItems);

// Finance V1 - Monthly Summary Routes (all require authentication)
// POST /api/admin/finance-v1/monthly-summary/summary - Get monthly summary analytics
router.post('/finance-v1/monthly-summary/summary', verifyToken, getFinanceV1MonthlySummary);

// POST /api/admin/finance-v1/monthly-summary/items - Get monthly summary items
router.post('/finance-v1/monthly-summary/items', verifyToken, getFinanceV1MonthlySummaryItems);

// Finance V1 - Yearly Summary Routes (all require authentication)
// POST /api/admin/finance-v1/yearly-summary/summary - Get yearly summary analytics
router.post('/finance-v1/yearly-summary/summary', verifyToken, getFinanceV1YearlySummary);

// POST /api/admin/finance-v1/yearly-summary/table - Get yearly summary table data
router.post('/finance-v1/yearly-summary/table', verifyToken, getFinanceV1YearlySummaryTable);

export default router;
