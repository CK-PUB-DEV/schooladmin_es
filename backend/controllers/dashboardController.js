import mysql from 'mysql2/promise';
import db from '../config/db.js';
import { getAccountReceivableSummaryTotals } from './accountReceivablesController.js';
import { getFinanceV1ReceivableSummaryTotals } from './financeV1Controller.js';
import { fetchCollectionTransactions, normalizeDateKey, round2 } from './financeV2ReportUtils.js';

/**
 * Get school database connection
 */
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

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatMonthKey = (date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`;

const monthStartOf = (date) => new Date(date.getFullYear(), date.getMonth(), 1);

const buildRecentMonthKeys = (count = 12) => {
  const now = new Date();
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const current = new Date(now.getFullYear(), now.getMonth() - index, 1);
    months.push({
      key: formatMonthKey(current),
      label: current.toLocaleString('en-US', { month: 'short' }),
    });
  }
  return months;
};

const sumNetCollections = (transactions, predicate = () => true) =>
  round2(
    (transactions || []).reduce(
      (sum, transaction) =>
        predicate(transaction) ? sum + Number(transaction.net_amount || 0) : sum,
      0
    )
  );

/**
 * Check if finance_v1 is enabled for this school
 */
const isFinanceV1 = async (schoolDbConfig) => {
  if (!schoolDbConfig?.db_name) return false;

  if (schoolDbConfig.finance_v1 !== undefined && schoolDbConfig.finance_v1 !== null) {
    return Number(schoolDbConfig.finance_v1) === 1;
  }

  try {
    const [rows] = await db.query(
      'SELECT finance_v1 FROM schools WHERE db_name = ? LIMIT 1',
      [schoolDbConfig.db_name]
    );
    return rows?.[0]?.finance_v1 === 1;
  } catch {
    return false;
  }
};

/**
 * Get comprehensive dashboard data for admin portal
 */
export const getDashboardData = async (req, res) => {
  let schoolDb = null;

  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig || !schoolDbConfig.db_name || !schoolDbConfig.db_username) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    schoolDb = await getSchoolConnection(schoolDbConfig);
    const useFinanceV1 = await isFinanceV1(schoolDbConfig);

    // Get active school year and semester
    const [activeSchoolYear] = await schoolDb.execute(
      'SELECT * FROM sy WHERE isactive = 1 LIMIT 1'
    );
    const [activeSemester] = await schoolDb.execute(
      'SELECT * FROM semester WHERE isactive = 1 LIMIT 1'
    );

    const activeSyId = activeSchoolYear[0]?.id || 0;
    const activeSemId = activeSemester[0]?.id || 0;

    // === ENROLLMENT DATA ===
    const enrollmentStatusFilter = [1, 2, 4];
    const [enrollmentRows] = await schoolDb.execute(
      `
        SELECT
          combined.studid,
          combined.levelid,
          gl.levelname,
          gl.sortid,
          gl.acadprogid,
          si.gender
        FROM (
          SELECT e.studid, e.levelid
          FROM enrolledstud e
          WHERE e.deleted = 0 AND e.syid = ? AND e.studstatus IN (${enrollmentStatusFilter.map(() => '?').join(',')})
          UNION ALL
          SELECT e.studid, e.levelid
          FROM sh_enrolledstud e
          WHERE e.deleted = 0 AND e.syid = ? AND e.studstatus IN (${enrollmentStatusFilter.map(() => '?').join(',')})
          UNION ALL
          SELECT e.studid, e.yearLevel as levelid
          FROM college_enrolledstud e
          WHERE e.deleted = 0 AND e.syid = ? AND e.semid = ? AND e.studstatus IN (${enrollmentStatusFilter.map(() => '?').join(',')})
        ) combined
        JOIN studinfo si ON si.id = combined.studid AND si.deleted = 0 AND si.studisactive = 1
        LEFT JOIN gradelevel gl ON gl.id = combined.levelid
      `,
      [
        activeSyId,
        ...enrollmentStatusFilter,
        activeSyId,
        ...enrollmentStatusFilter,
        activeSyId,
        activeSemId,
        ...enrollmentStatusFilter,
      ]
    );

    const seenStudentIds = new Set();
    const dedupedEnrollmentRows = [];
    enrollmentRows.forEach((row) => {
      if (seenStudentIds.has(row.studid)) return;
      seenStudentIds.add(row.studid);
      dedupedEnrollmentRows.push(row);
    });

    const totalEnrolled = dedupedEnrollmentRows.length;
    const genderCounts = dedupedEnrollmentRows.reduce(
      (acc, row) => {
        const gender = String(row.gender || '').toUpperCase();
        if (gender === 'M' || gender === 'MALE') acc.male += 1;
        if (gender === 'F' || gender === 'FEMALE') acc.female += 1;
        return acc;
      },
      { male: 0, female: 0 }
    );

    const studentGender = [
      { label: 'Male', value: genderCounts.male },
      { label: 'Female', value: genderCounts.female },
    ];

    const gradeLevelMap = new Map();
    dedupedEnrollmentRows.forEach((row) => {
      const key = row.levelid || 'unknown';
      if (!gradeLevelMap.has(key)) {
        gradeLevelMap.set(key, {
          label: row.levelname || 'Unknown',
          value: 0,
          sortid: Number(row.sortid) || 999,
        });
      }
      gradeLevelMap.get(key).value += 1;
    });

    const gradeLevels = Array.from(gradeLevelMap.values())
      .sort((a, b) => a.sortid - b.sortid || a.label.localeCompare(b.label))
      .map(({ label, value }) => ({ label, value }));

    // Pending enrollments
    const [pendingEnrollments] = await schoolDb.execute(
      `SELECT COUNT(*) as count FROM (
        SELECT id FROM enrolledstud WHERE deleted = 0 AND syid = ? AND studstatus = 0
        UNION ALL
        SELECT id FROM sh_enrolledstud WHERE deleted = 0 AND syid = ? AND studstatus = 0
        UNION ALL
        SELECT id FROM college_enrolledstud WHERE deleted = 0 AND syid = ? AND semid = ? AND studstatus = 0
      ) AS pending`,
      [activeSyId, activeSyId, activeSyId, activeSemId]
    );

    // === EMPLOYEE DATA ===
    const [employeeCount] = await schoolDb.execute(
      `SELECT COUNT(DISTINCT t.id) as count FROM teacher t WHERE t.deleted = 0`
    );

    // Employee by user type/department
    const [employeesByType] = await schoolDb.execute(
      `SELECT
        COALESCE(ut.utype, 'Unassigned') as label,
        COUNT(*) as value
      FROM teacher t
      LEFT JOIN users u ON t.userid = u.id
      LEFT JOIN usertype ut ON u.type = ut.id
      WHERE t.deleted = 0
      GROUP BY ut.utype
      ORDER BY value DESC
      LIMIT 5`
    );

    // === FINANCE DATA ===
    const todayDate = new Date();
    const today = formatDateInput(todayDate);
    const monthStart = formatDateInput(monthStartOf(todayDate));
    const recentMonths = buildRecentMonthKeys(12);
    const twelveMonthStart = `${recentMonths[0]?.key || formatMonthKey(todayDate)}-01`;

    let collectionsToday = 0;
    let collectionsMTD = 0;
    let receivables = 0;
    let receivablesFallback = 0;
    let monthlyCollections = [];

    if (useFinanceV1) {
      // Finance V1 uses older transaction rows and ledger-based receivables.
      try {
        const [todayCollections] = await schoolDb.execute(
          `SELECT COALESCE(SUM(IFNULL(amountpaid, 0)), 0) as total FROM chrngtrans
           WHERE cancelled = 0 AND DATE(transdate) = ? AND syid = ?`,
          [today, activeSyId]
        );
        collectionsToday = Number(todayCollections[0]?.total || 0);
      } catch {
        collectionsToday = 0;
      }

      try {
        const [mtdCollections] = await schoolDb.execute(
          `SELECT COALESCE(SUM(IFNULL(amountpaid, 0)), 0) as total FROM chrngtrans
           WHERE cancelled = 0 AND DATE(transdate) >= ? AND DATE(transdate) <= ? AND syid = ?`,
          [monthStart, today, activeSyId]
        );
        collectionsMTD = Number(mtdCollections[0]?.total || 0);
      } catch {
        collectionsMTD = 0;
      }

      // Receivables from studledger (Finance V1 approach)
      // Logic: totalassessment(amount) - discount - payments = balance
      try {
        const [receivablesData] = await schoolDb.execute(
          `SELECT
            COALESCE(SUM(amount), 0) -
            COALESCE(SUM(CASE WHEN particulars LIKE '%DISCOUNT:%' THEN payment ELSE 0 END), 0) -
            COALESCE(SUM(CASE WHEN particulars NOT LIKE '%DISCOUNT:%' THEN payment ELSE 0 END), 0) as balance
           FROM studledger
           WHERE deleted = 0 AND syid = ?`,
          [activeSyId]
        );
        receivablesFallback = Math.max(0, Number(receivablesData[0]?.balance || 0));
      } catch {
        receivablesFallback = 0;
      }

      try {
        const [monthlyData] = await schoolDb.execute(
          `SELECT
            DATE_FORMAT(transdate, '%Y-%m') as month,
            COALESCE(SUM(IFNULL(amountpaid, 0)), 0) as total
          FROM chrngtrans
          WHERE cancelled = 0 AND DATE(transdate) >= ?
          GROUP BY DATE_FORMAT(transdate, '%Y-%m')
          ORDER BY month`,
          [twelveMonthStart]
        );
        monthlyCollections = monthlyData;
      } catch {
        monthlyCollections = [];
      }
    } else {
      try {
        const transactions = await fetchCollectionTransactions(schoolDb, {
          syid: activeSyId,
          startDate: twelveMonthStart,
          endDate: today,
        });
        collectionsToday = sumNetCollections(
          transactions,
          (transaction) => normalizeDateKey(transaction.trans_day || transaction.transdate) === today
        );
        collectionsMTD = sumNetCollections(
          transactions,
          (transaction) => normalizeDateKey(transaction.trans_day || transaction.transdate) >= monthStart
        );

        const monthlyMap = new Map();
        transactions.forEach((transaction) => {
          const month = normalizeDateKey(transaction.transdate || transaction.trans_day).slice(0, 7);
          if (!month) return;
          monthlyMap.set(month, Number(monthlyMap.get(month) || 0) + Number(transaction.net_amount || 0));
        });
        monthlyCollections = Array.from(monthlyMap.entries()).map(([month, total]) => ({
          month,
          total: round2(total),
        }));
      } catch {
        collectionsToday = 0;
        collectionsMTD = 0;
        monthlyCollections = [];
      }

      receivablesFallback = 0;
    }

    let summaryReceivables = null;
    try {
      if (useFinanceV1) {
        const summaryData = await getFinanceV1ReceivableSummaryTotals({
          schoolDbConfig,
          syid: activeSyId,
          semid: activeSemId,
        });
        const totalReceivable = Number(summaryData?.summary?.total_receivable);
        if (Number.isFinite(totalReceivable)) {
          summaryReceivables = totalReceivable;
        }
      } else {
        const summaryData = await getAccountReceivableSummaryTotals({
          schoolDbConfig,
          syid: activeSyId,
          semid: activeSemId,
        });
        const totalReceivable = Number(summaryData?.summary?.total_receivable);
        if (Number.isFinite(totalReceivable)) {
          summaryReceivables = totalReceivable;
        }
      }
    } catch (error) {
      console.error('Error computing dashboard receivables summary:', error);
    }

    receivables = summaryReceivables !== null ? summaryReceivables : receivablesFallback;

    // Build 12-month collections array
    const monthLabels = recentMonths.map((month) => month.label);
    const collectionsData = [];
    for (const month of recentMonths) {
      const monthKey = month.key;
      const found = monthlyCollections.find((m) => m.month === monthKey);
      collectionsData.push(Number(found?.total || 0));
    }

    // === CALENDAR EVENTS ===
    const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let upcomingEvents = [];
    let upcomingEventsCount = 0;

    try {
      const [events] = await schoolDb.execute(
        `SELECT id, title, start, end, venue, holiday, isnoclass
         FROM schoolcalendar
         WHERE deleted = 0 AND DATE(start) >= CURDATE() AND DATE(start) <= ?
         ORDER BY start ASC
         LIMIT 10`,
        [thirtyDaysLater]
      );
      upcomingEvents = events.map((e) => ({
        id: e.id,
        title: e.title,
        when: new Date(e.start).toLocaleDateString(),
        venue: e.venue,
      }));
      upcomingEventsCount = events.length;
    } catch {
      // Table might not exist
    }

    // === MEMO DATA ===
    let recentMemos = [];
    let memosThisWeek = 0;

    try {
      const [memos] = await schoolDb.execute(
        `SELECT id, title, created_at, recipient_type
         FROM memos
         WHERE deleted = 0
         ORDER BY created_at DESC
         LIMIT 5`
      );
      recentMemos = memos.map((m) => ({
        id: m.id,
        title: m.title,
        audience: m.recipient_type || 'All',
      }));

      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const [weekMemos] = await schoolDb.execute(
        `SELECT COUNT(*) as count FROM memos WHERE deleted = 0 AND DATE(created_at) >= ?`,
        [weekAgo]
      );
      memosThisWeek = Number(weekMemos[0]?.count || 0);
    } catch {
      // Table might not exist
    }

    await schoolDb.end();

    // Build response
    res.status(200).json({
      status: 'success',
      data: {
        kpis: {
          enrolledStudents: totalEnrolled,
          pendingEnrollments: Number(pendingEnrollments[0]?.count || 0),
          employees: Number(employeeCount[0]?.count || 0),
          collectionsToday,
          collectionsMTD,
          receivables,
          upcomingEvents: upcomingEventsCount,
          memosThisWeek,
        },
        finance: {
          monthLabels,
          collectionsData,
        },
        charts: {
          studentGender,
          gradeLevels: gradeLevels.map((g) => ({ label: g.label, value: Number(g.value) })),
          departments: employeesByType.map((e) => ({ label: e.label, value: Number(e.value) })),
        },
        lists: {
          events: upcomingEvents,
          memos: recentMemos,
        },
        activeSchoolYear: activeSchoolYear[0] || null,
        activeSemester: activeSemester[0] || null,
      },
    });
  } catch (error) {
    if (schoolDb) {
      try {
        await schoolDb.end();
      } catch {
        // Ignore close error
      }
    }

    console.error('Error fetching dashboard data:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch dashboard data',
      error: error.message,
    });
  }
};
