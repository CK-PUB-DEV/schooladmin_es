import mysql from 'mysql2/promise';
import {
  buildCollectionSummaryData,
  buildYearlyTableData,
  fetchProcessedCollectionItems,
  resolveYearEndWindow,
} from './financeV2ReportUtils.js';

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

const pad2 = (value) => String(value).padStart(2, '0');

const formatDateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

const parseDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatMonthKey = (date) => `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`;

const formatMonthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  if (!year || !month) return key;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
};

const buildMonthRange = (startDate, endDate) => {
  const months = [];
  if (!startDate || !endDate) return months;
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= last) {
    const key = formatMonthKey(current);
    months.push({ key, label: formatMonthLabel(key) });
    current.setMonth(current.getMonth() + 1);
  }

  return months;
};

const buildFilters = ({ startDate, endDate, paymentTypeId, status }) => {
  const params = [];
  let clause = '';

  const resolvedStatus = status && status !== 'all' ? status : null;
  if (resolvedStatus === 'posted') {
    clause += ' AND t.cancelled = 0 AND t.posted = 1';
  } else if (resolvedStatus === 'cancelled') {
    clause += ' AND t.cancelled = 1';
  } else if (resolvedStatus === 'pending') {
    clause += ' AND t.cancelled = 0 AND (t.posted = 0 OR t.posted IS NULL)';
  } else {
    clause += ' AND t.cancelled = 0';
  }

  if (startDate) {
    clause += ' AND DATE(t.transdate) >= ?';
    params.push(startDate);
  }

  if (endDate) {
    clause += ' AND DATE(t.transdate) <= ?';
    params.push(endDate);
  }

  if (paymentTypeId) {
    clause += ' AND t.paymenttype_id = ?';
    params.push(paymentTypeId);
  }

  return { clause, params };
};

const normalizeItemLabel = "COALESCE(NULLIF(TRIM(cct.particulars), ''), 'Unspecified')";

export const getMonthlySummary = async (req, res) => {
  try {
    const { schoolDbConfig, startDate, endDate, paymentTypeId, status } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const processed = await fetchProcessedCollectionItems(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
    });
    const summaryData = buildCollectionSummaryData(processed);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: summaryData,
    });
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch monthly summary',
      error: error.message,
    });
  }
};

export const getMonthlySummaryItems = async (req, res) => {
  try {
    const { schoolDbConfig, startDate, endDate, paymentTypeId, status } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const processed = await fetchProcessedCollectionItems(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
    });
    const { byItem } = buildCollectionSummaryData(processed);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: byItem || [],
    });
  } catch (error) {
    console.error('Error fetching monthly summary items:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch monthly summary items',
      error: error.message,
    });
  }
};

export const getYearlySummary = async (req, res) => {
  try {
    const { schoolDbConfig, syid, paymentTypeId, status } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    if (!syid) {
      return res.status(400).json({
        status: 'error',
        message: 'School year is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    const [syRows] = await db.execute(
      'SELECT id, sydesc, sdate, edate FROM sy WHERE id = ? LIMIT 1',
      [syid]
    );

    if (syRows.length === 0) {
      await db.end();
      return res.status(404).json({
        status: 'error',
        message: 'School year not found',
      });
    }

    const schoolYear = syRows[0];
    const window = await resolveYearEndWindow(db, syid, schoolYear);

    if (!window) {
      await db.end();
      return res.status(400).json({
        status: 'error',
        message: 'School year date range is invalid',
      });
    }

    const processed = await fetchProcessedCollectionItems(db, {
      syid,
      startDate: window.startDate,
      endDate: window.endDate,
      paymentTypeId,
      status,
    });
    const summaryData = buildCollectionSummaryData(processed);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        schoolYear: {
          id: schoolYear.id,
          sydesc: schoolYear.sydesc,
          startDate: window.startDate,
          endDate: window.endDate,
        },
        ...summaryData,
      },
    });
  } catch (error) {
    console.error('Error fetching yearly summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch yearly summary',
      error: error.message,
    });
  }
};

export const getYearlySummaryTable = async (req, res) => {
  try {
    const { schoolDbConfig, syid, paymentTypeId, status } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    if (!syid) {
      return res.status(400).json({
        status: 'error',
        message: 'School year is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    const [syRows] = await db.execute(
      'SELECT id, sydesc, sdate, edate FROM sy WHERE id = ? LIMIT 1',
      [syid]
    );

    if (syRows.length === 0) {
      await db.end();
      return res.status(404).json({
        status: 'error',
        message: 'School year not found',
      });
    }

    const schoolYear = syRows[0];
    const window = await resolveYearEndWindow(db, syid, schoolYear);

    if (!window) {
      await db.end();
      return res.status(400).json({
        status: 'error',
        message: 'School year date range is invalid',
      });
    }

    const processed = await fetchProcessedCollectionItems(db, {
      syid,
      startDate: window.startDate,
      endDate: window.endDate,
      paymentTypeId,
      status,
    });
    const tableData = buildYearlyTableData(processed.processedItems, window.months);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        schoolYear: {
          id: schoolYear.id,
          sydesc: schoolYear.sydesc,
          startDate: window.startDate,
          endDate: window.endDate,
        },
        ...tableData,
      },
    });
  } catch (error) {
    console.error('Error fetching yearly summary table:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch yearly summary table',
      error: error.message,
    });
  }
};
