import mysql from 'mysql2/promise';

// ============================================================================
// SHARED HELPER FUNCTIONS
// ============================================================================

/**
 * Create database connection to school database
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

/**
 * Safe number conversion
 */
const toNumber = (value) => Number(value) || 0;

/**
 * Format date to YYYY-MM-DD string
 */
const formatDateToString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Get date range from shortcut filter
 * Shortcuts: '30days', '60days', '90days', '1year', 'custom'
 * For custom, startDate and endDate should be provided
 */
const getDateRangeFromFilter = (dateFilter, startDate, endDate) => {
  if (!dateFilter && !startDate && !endDate) {
    return { dateFrom: null, dateTo: null };
  }

  const today = new Date();
  let dateFrom = null;
  let dateTo = formatDateToString(today);

  switch (dateFilter) {
    case '30days':
      dateFrom = new Date(today);
      dateFrom.setDate(dateFrom.getDate() - 30);
      dateFrom = formatDateToString(dateFrom);
      break;
    case '60days':
      dateFrom = new Date(today);
      dateFrom.setDate(dateFrom.getDate() - 60);
      dateFrom = formatDateToString(dateFrom);
      break;
    case '90days':
      dateFrom = new Date(today);
      dateFrom.setDate(dateFrom.getDate() - 90);
      dateFrom = formatDateToString(dateFrom);
      break;
    case '1year':
      dateFrom = new Date(today);
      dateFrom.setFullYear(dateFrom.getFullYear() - 1);
      dateFrom = formatDateToString(dateFrom);
      break;
    case 'custom':
      // Use provided startDate and endDate
      dateFrom = startDate || null;
      dateTo = endDate || formatDateToString(today);
      break;
    default:
      // If no shortcut but dates provided, use them directly
      if (startDate || endDate) {
        dateFrom = startDate || null;
        dateTo = endDate || formatDateToString(today);
      }
      break;
  }

  return { dateFrom, dateTo };
};

const parseIdParam = (value) => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseSelectedDateRange = (value) => {
  if (!value || typeof value !== 'string') {
    return { dateFrom: null, dateTo: null };
  }

  const parts = value.split(' - ');
  if (parts.length !== 2) {
    return { dateFrom: null, dateTo: null };
  }

  const dateFrom = parts[0].trim();
  const dateTo = parts[1].trim();

  return {
    dateFrom: dateFrom || null,
    dateTo: dateTo || null,
  };
};

const resolveReceivableFilters = (payload = {}) => {
  const legacyDateRange = parseSelectedDateRange(payload.selecteddaterange);
  const dateRange =
    legacyDateRange.dateFrom || legacyDateRange.dateTo
      ? legacyDateRange
      : getDateRangeFromFilter(payload.dateFilter, payload.startDate, payload.endDate);

  return {
    syid: parseIdParam(payload.syid ?? payload.selectedschoolyear),
    semid: parseIdParam(payload.semid ?? payload.selectedsemester),
    programId: parseIdParam(payload.programId ?? payload.selecteddepartment),
    levelId: parseIdParam(payload.levelId ?? payload.selectedgradelevel),
    sectionId: parseIdParam(payload.sectionId ?? payload.selectedsection),
    granteeId: parseIdParam(payload.granteeId ?? payload.selectedgrantee),
    modeId: parseIdParam(payload.modeId ?? payload.selectedmode),
    search: payload.search || null,
    page: payload.page,
    perPage: payload.perPage,
    dateRange,
  };
};

// ============================================================================
// FINANCE V1 STUDLEDGER-BASED CALCULATION
// Based on AccountsReceivableModel.php logic
// ============================================================================

/**
 * Calculate student totals directly from studledger table (finance_v1 approach)
 * This mirrors the PHP AccountsReceivableModel.php logic where:
 * - totalassessment = SUM(amount) from studledger
 * - discount = SUM(payment) WHERE particulars LIKE '%DISCOUNT:%'
 * - totalpayment = SUM(payment) WHERE particulars NOT LIKE '%DISCOUNT:%'
 * - netassessed = totalassessment - discount
 * - balance = netassessed - totalpayment
 *
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const calculateStudentTotalsFromLedger = async (db, student, syid, semid, schoolInfo, dateRange = {}) => {
  if (!syid) {
    return {
      total_fees: 0,
      discount: 0,
      net_assessed: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };
  }

  try {
    const params = [student.id, syid];
    let query = `
      SELECT
        SUM(amount) as total_amount,
        SUM(CASE WHEN particulars LIKE '%DISCOUNT:%' THEN payment ELSE 0 END) as total_discount,
        SUM(CASE WHEN particulars NOT LIKE '%DISCOUNT:%' THEN payment ELSE 0 END) as total_payment
      FROM studledger
      WHERE studid = ? AND syid = ? AND deleted = '0'
    `;

    if (semid !== null && semid !== undefined) {
      query += ' AND semid = ?';
      params.push(semid);
    }

    // Apply date range filter (matches PHP: filter by createddatetime)
    const { dateFrom, dateTo } = dateRange;
    if (dateFrom) {
      query += ' AND createddatetime >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND createddatetime <= ?';
      params.push(dateTo);
    }

    const [rows] = await db.execute(query, params);
    const totalAmount = toNumber(rows[0]?.total_amount);
    const totalDiscount = toNumber(rows[0]?.total_discount);
    const totalPayment = toNumber(rows[0]?.total_payment);

    // Match PHP logic: netassessed = totalassessment - discount, balance = netassessed - totalpayment
    const netAssessed = totalAmount - totalDiscount;
    const balance = netAssessed - totalPayment;
    const overpayment = Math.max(totalPayment - netAssessed, 0);

    return {
      total_fees: Number(totalAmount.toFixed(2)),
      discount: Number(totalDiscount.toFixed(2)),
      net_assessed: Number(netAssessed.toFixed(2)),
      total_paid: Number(totalPayment.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      overpayment: Number(overpayment.toFixed(2)),
    };
  } catch (error) {
    // Return zeros if query fails
    return {
      total_fees: 0,
      discount: 0,
      net_assessed: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };
  }
};

/**
 * Check if studledger has entries for this student/sy combination
 * Used to determine if we should use ledger-based calculation
 */
const hasStudledgerEntries = async (db, studid, syid) => {
  try {
    const [rows] = await db.execute(
      'SELECT COUNT(*) as count FROM studledger WHERE studid = ? AND syid = ? AND deleted = \'0\' LIMIT 1',
      [studid, syid]
    );
    return toNumber(rows[0]?.count) > 0;
  } catch (error) {
    // Table might not exist, return false to use fallback calculation
    return false;
  }
};

// ============================================================================
// OPTIMIZED BULK QUERY FUNCTIONS FOR FINANCE V1
// These functions fetch data for all students in a single query
// ============================================================================

/**
 * Get all student balances from studledger in a single bulk query
 * This is much faster than querying per-student
 *
 * IMPORTANT: Matches PHP AccountsReceivableModel logic:
 * - totalassessment = SUM(amount) from studledger
 * - discount = SUM(payment) WHERE particulars LIKE '%DISCOUNT:%'
 * - totalpayment = SUM(payment) WHERE particulars NOT LIKE '%DISCOUNT:%'
 * - netassessed = totalassessment - discount
 * - balance = netassessed - totalpayment
 *
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const getBulkStudentBalancesFromLedger = async (db, studentIds, syid, semid, schoolInfo, dateRange = {}) => {
  if (!studentIds.length || !syid) {
    return new Map();
  }

  try {
    const placeholders = studentIds.map(() => '?').join(',');
    const params = [...studentIds, syid];

    // Base query - get totals grouped by student
    // Separates discounts from regular payments based on particulars field
    let query = `
      SELECT
        sl.studid,
        SUM(sl.amount) as total_amount,
        SUM(CASE WHEN sl.particulars LIKE '%DISCOUNT:%' THEN sl.payment ELSE 0 END) as total_discount,
        SUM(CASE WHEN sl.particulars NOT LIKE '%DISCOUNT:%' THEN sl.payment ELSE 0 END) as total_payment
      FROM studledger sl
      WHERE sl.studid IN (${placeholders}) AND sl.syid = ? AND sl.deleted = '0'
    `;

    if (semid !== null && semid !== undefined) {
      query += ' AND sl.semid = ?';
      params.push(semid);
    }

    // Apply date range filter (matches PHP: filter by createddatetime)
    const { dateFrom, dateTo } = dateRange;
    if (dateFrom) {
      query += ' AND sl.createddatetime >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND sl.createddatetime <= ?';
      params.push(dateTo);
    }

    query += ' GROUP BY sl.studid';

    const [rows] = await db.execute(query, params);

    const balanceMap = new Map();
    for (const row of rows) {
      const totalAmount = toNumber(row.total_amount);
      const totalDiscount = toNumber(row.total_discount);
      const totalPayment = toNumber(row.total_payment);

      // Match PHP logic: netassessed = totalassessment - discount, balance = netassessed - totalpayment
      const netAssessed = totalAmount - totalDiscount;
      const balance = netAssessed - totalPayment;
      const overpayment = Math.max(totalPayment - netAssessed, 0);

      balanceMap.set(row.studid, {
        total_fees: Number(totalAmount.toFixed(2)),
        discount: Number(totalDiscount.toFixed(2)),
        net_assessed: Number(netAssessed.toFixed(2)),
        total_paid: Number(totalPayment.toFixed(2)),
        balance: Number(balance.toFixed(2)),
        overpayment: Number(overpayment.toFixed(2)),
      });
    }

    return balanceMap;
  } catch (error) {
    console.error('Error in bulk ledger query:', error);
    return new Map();
  }
};

/**
 * Optimized function to get students with their balances in minimal queries
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const getStudentsWithBalancesBulk = async (db, students, syid, semid, schoolInfo, dateRange = {}) => {
  if (!students.length) {
    return [];
  }

  const studentIds = students.map((s) => s.id);

  // Get all balances in one query
  const balanceMap = await getBulkStudentBalancesFromLedger(db, studentIds, syid, semid, schoolInfo, dateRange);

  // Merge student data with balances
  const result = [];
  for (const student of students) {
    const totals = balanceMap.get(student.id) || {
      total_fees: 0,
      discount: 0,
      net_assessed: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };

    const fullName = [student.lastname, student.firstname, student.middlename]
      .filter(Boolean)
      .join(' ')
      .trim();

    result.push({
      ...student,
      full_name: fullName || student.sid || 'Unknown',
      ...totals,
    });
  }

  return result;
};

const tuitionDetailColumnCache = new Map();

const hasTuitionDetailPerSubj = async (db) => {
  const dbName =
    db?.config?.database ||
    db?.connection?.config?.database ||
    null;
  const cacheKey = dbName ? `${dbName}.tuitiondetail.persubj` : null;

  if (cacheKey && tuitionDetailColumnCache.has(cacheKey)) {
    return tuitionDetailColumnCache.get(cacheKey);
  }

  const [rows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'tuitiondetail'
       AND column_name = 'persubj'`
  );
  const hasColumn = Number(rows?.[0]?.count || 0) > 0;
  if (cacheKey) {
    tuitionDetailColumnCache.set(cacheKey, hasColumn);
  }
  return hasColumn;
};

const bookEntriesColumnCache = new Map();

const hasBookEntriesColumn = async (db, columnName) => {
  const dbName =
    db?.config?.database ||
    db?.connection?.config?.database ||
    null;
  const cacheKey = dbName ? `${dbName}.bookentries.${columnName}` : null;

  if (cacheKey && bookEntriesColumnCache.has(cacheKey)) {
    return bookEntriesColumnCache.get(cacheKey);
  }

  const [rows] = await db.execute(
    `SELECT COUNT(*) as count
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = 'bookentries'
       AND column_name = ?`,
    [columnName]
  );
  const hasColumn = Number(rows?.[0]?.count || 0) > 0;
  if (cacheKey) {
    bookEntriesColumnCache.set(cacheKey, hasColumn);
  }
  return hasColumn;
};

/**
 * Get school info including shssetup flag
 */
const getSchoolInfo = async (db) => {
  const [rows] = await db.execute('SELECT shssetup FROM schoolinfo LIMIT 1');
  return rows[0] || null;
};

/**
 * Get balance forward classification ID
 */
const getBalForwardClassId = async (db) => {
  const [rows] = await db.execute('SELECT classid FROM balforwardsetup LIMIT 1');
  return rows[0]?.classid || null;
};

/**
 * Get academic programs
 */
const getAcademicPrograms = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, progname, acadprogcode FROM academicprogram ORDER BY id'
  );
  return rows;
};

/**
 * Get grade levels
 */
const getGradeLevels = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, levelname, acadprogid FROM gradelevel WHERE deleted = \'0\' ORDER BY levelname'
  );
  return rows;
};

const getGrantees = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, description FROM grantee ORDER BY description'
  );
  return rows;
};

const getModesOfLearning = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, description FROM modeoflearning WHERE deleted = \'0\' ORDER BY description'
  );
  return rows;
};

const getSectionsByLevel = async (db, levelId) => {
  if (!levelId) {
    return [];
  }

  const [levelRows] = await db.execute(
    `SELECT ap.acadprogcode
     FROM gradelevel gl
     JOIN academicprogram ap ON gl.acadprogid = ap.id
     WHERE gl.id = ?
     LIMIT 1`,
    [levelId]
  );
  const acadProgCode = (levelRows[0]?.acadprogcode || '').toLowerCase();

  if (acadProgCode === 'college') {
    const [sections] = await db.execute(
      `SELECT id, sectionDesc as sectionname
       FROM college_sections
       WHERE yearID = ? AND deleted = '0'
       ORDER BY sectionDesc`,
      [levelId]
    );
    return sections;
  }

  const [sections] = await db.execute(
    `SELECT id, sectionname
     FROM sections
     WHERE levelid = ? AND deleted = '0'
     ORDER BY sectionname`,
    [levelId]
  );
  return sections;
};

/**
 * Get school years (limited to recent years)
 */
const getSchoolYears = async (db, limit = 4) => {
  const [rows] = await db.execute(
    'SELECT id, sydesc, sdate, edate, isactive FROM sy WHERE isactive IN (0, 1) ORDER BY sydesc DESC'
  );
  return rows.slice(0, Math.max(1, limit));
};

/**
 * Get enrolled student IDs for given filters
 */
const getEnrolledStudentIds = async (db, syid, semid, programId) => {
  if (!syid && !semid) {
    return null;
  }

  const ids = new Set();
  const includeBasic = !programId || [2, 3, 4].includes(programId);
  const includeShs = !programId || programId === 5;
  const includeCollege = !programId || programId === 6;

  const addIds = async (table, useSem) => {
    const params = [];
    let query = `SELECT studid FROM ${table} WHERE deleted = '0'`;
    if (syid) {
      query += ' AND syid = ?';
      params.push(syid);
    }
    if (useSem && semid) {
      query += ' AND semid = ?';
      params.push(semid);
    }

    try {
      const [rows] = await db.execute(query, params);
      rows.forEach((row) => ids.add(row.studid));
    } catch (error) {
      if (error?.code === 'ER_NO_SUCH_TABLE') {
        return;
      }
      throw error;
    }
  };

  if (includeBasic) {
    await addIds('enrolledstud', false);
  }
  if (includeShs) {
    await addIds('sh_enrolledstud', true);
  }
  if (includeCollege) {
    await addIds('college_enrolledstud', true);
  }

  return Array.from(ids);
};

/**
 * Determine enrollment table by level ID
 */
const getEnrollmentTable = (levelid) => {
  if (levelid === 14 || levelid === 15) return 'sh_enrolledstud';
  if (levelid >= 17 && levelid <= 25) return 'college_enrolledstud';
  return 'enrolledstud';
};

/**
 * Check if level uses semester filtering
 */
const useSemesterForLevel = (levelid) => levelid >= 14 && levelid <= 25;

/**
 * Get fees ID for student
 */
const getFeesIdForStudent = async (db, student, syid, semid) => {
  if (student.feesid) {
    return student.feesid;
  }

  if (!syid) {
    return null;
  }

  const enrollTable = getEnrollmentTable(student.levelid);
  const params = [student.id, syid];
  let query = `SELECT feesid FROM ${enrollTable} WHERE studid = ? AND syid = ? AND deleted = '0'`;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  query += ' ORDER BY id DESC LIMIT 1';
  const [rows] = await db.execute(query, params);
  return rows[0]?.feesid || null;
};

/**
 * Calculate student units for college (tuition calculation)
 */
const getStudentUnits = async (db, studid, syid, semid, levelid) => {
  if (!(levelid >= 17 && levelid <= 25)) {
    return 0;
  }

  const [rows] = await db.execute(
    `SELECT cp.lecunits, cp.labunits, cp.subjectID
     FROM college_loadsubject cls
     JOIN college_prospectus cp ON cls.subjectID = cp.id
     WHERE cls.studid = ? AND cls.syid = ? AND cls.semid = ? AND cls.deleted = '0'`,
    [studid, syid, semid]
  );

  let totalUnits = 0;
  for (const unit of rows) {
    const [assessmentRows] = await db.execute(
      'SELECT id FROM tuition_assessmentunit WHERE subjid = ? AND deleted = \'0\' LIMIT 1',
      [unit.subjectID]
    );
    if (assessmentRows.length > 0) {
      totalUnits += 1.5;
    } else {
      totalUnits += toNumber(unit.lecunits) + toNumber(unit.labunits);
    }
  }

  return totalUnits;
};

/**
 * Get student subject count for per-subject fees
 */
const getStudentSubjectCount = async (db, studid, syid, semid, levelid) => {
  if (levelid >= 17 && levelid <= 25) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM college_loadsubject
       WHERE studid = ? AND syid = ? AND semid = ? AND deleted = '0'`,
      [studid, syid, semid]
    );
    return toNumber(rows[0]?.count);
  }

  if (levelid === 14 || levelid === 15) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM sh_studsched ss
       JOIN sh_classsched sc ON ss.schedid = sc.id
       WHERE ss.studid = ? AND ss.deleted = '0' AND sc.deleted = '0'
         AND sc.syid = ? AND sc.semid = ?`,
      [studid, syid, semid]
    );
    return toNumber(rows[0]?.count);
  }

  return 0;
};

// ============================================================================
// FEE CALCULATION ENGINE
// ============================================================================

/**
 * Fetch tuition fees from tuitionheader/tuitiondetail
 */
const fetchTuitionFees = async (db, student, syid, semid, schoolInfo) => {
  if (!syid) {
    return [];
  }

  const feesId = await getFeesIdForStudent(db, student, syid, semid);
  const hasPerSubj = await hasTuitionDetailPerSubj(db);
  const params = [syid];
  let query = `
    SELECT
      td.classificationid as classid,
      td.amount,
      td.istuition,
      ${hasPerSubj ? 'td.persubj' : '0 as persubj'}
    FROM tuitionheader th
    JOIN tuitiondetail td ON th.id = td.headerid
    JOIN itemclassification ic ON td.classificationid = ic.id
    WHERE th.syid = ?
      AND th.deleted = '0'
      AND td.deleted = '0'
      AND ic.deleted = '0'
  `;

  if (student.levelid === 14 || student.levelid === 15) {
    if (semid) {
      query += ' AND th.semid = ?';
      params.push(semid);
    }
  } else if (student.levelid >= 17 && student.levelid <= 25) {
    if (semid) {
      query += ' AND th.semid = ?';
      params.push(semid);
    }
  }

  if (feesId) {
    query += ' AND th.id = ?';
    params.push(feesId);
  } else {
    query += ' AND th.levelid = ?';
    params.push(student.levelid);

    const hasCourse = !!student.courseid;
    const hasStrand = !!student.strandid;
    const conditions = [];

    if (hasCourse) {
      conditions.push('th.courseid = ?');
      params.push(student.courseid);
    }

    if (hasStrand) {
      conditions.push('th.strandid = ?');
      params.push(student.strandid);
    }

    conditions.push('(th.courseid IS NULL AND th.strandid IS NULL)');
    query += ` AND (${conditions.join(' OR ')})`;
  }

  const [rows] = await db.execute(query, params);
  return rows;
};

/**
 * Apply discounts to fees
 */
const applyDiscounts = async (db, student, syid, semid, totalsByClass) => {
  if (!syid || Object.keys(totalsByClass).length === 0) {
    return totalsByClass;
  }

  const params = [student.id, syid];
  let query = `
    SELECT classid, SUM(discamount) as amount
    FROM studdiscounts
    WHERE studid = ? AND syid = ? AND deleted = '0' AND posted = 1
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  query += ' GROUP BY classid';
  const [rows] = await db.execute(query, params);

  const updated = { ...totalsByClass };
  rows.forEach((row) => {
    const classid = row.classid;
    const discount = toNumber(row.amount);
    if (!updated[classid]) return;
    const applied = Math.min(updated[classid], discount);
    updated[classid] = Math.max(updated[classid] - applied, 0);
  });

  return updated;
};

/**
 * Fetch book entries
 */
const fetchBookEntries = async (db, student, syid, semid) => {
  if (!syid) return 0;

  const hasSyid = await hasBookEntriesColumn(db, 'syid');
  if (!hasSyid) {
    return 0;
  }

  const params = [student.id, syid];
  let query = `
    SELECT SUM(amount) as amount
    FROM bookentries
    WHERE studid = ? AND syid = ? AND deleted = '0'
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    const hasSemid = await hasBookEntriesColumn(db, 'semid');
    if (hasSemid) {
      query += ' AND semid = ?';
      params.push(semid);
    }
  }

  const [rows] = await db.execute(query, params);
  return toNumber(rows[0]?.amount);
};

/**
 * Fetch adjustment charges (debit adjustments)
 */
const fetchAdjustmentCharges = async (db, student, syid, semid) => {
  if (!syid) return 0;

  const params = [student.id, syid];
  let query = `
    SELECT SUM(a.amount) as amount
    FROM adjustmentdetails ad
    JOIN adjustments a ON ad.headerid = a.id
    WHERE ad.studid = ? AND a.syid = ? AND ad.deleted = '0' AND a.deleted = '0'
      AND a.isdebit = 1
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND a.semid = ?';
    params.push(semid);
  }

  const [rows] = await db.execute(query, params);
  return toNumber(rows[0]?.amount);
};

/**
 * Fetch old account charges from studledger
 */
const fetchOldAccountCharges = async (db, student, syid, semid, balClassId) => {
  if (!syid || !balClassId) return 0;

  const params = [student.id, syid, balClassId];
  let query = `
    SELECT SUM(amount) as amount
    FROM studledger
    WHERE studid = ? AND syid = ? AND classid = ? AND amount > 0 AND deleted = '0' AND void = '0'
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  const [rows] = await db.execute(query, params);
  return toNumber(rows[0]?.amount);
};

/**
 * Fetch all student payments (chrngtrans + studledger + credit adjustments)
 */
const fetchStudentPayments = async (db, student, syid, semid, balClassId) => {
  if (!syid) return 0;

  const paymentParams = [student.id, syid];
  let paymentQuery = `
    SELECT SUM(amountpaid) as amount
    FROM chrngtrans
    WHERE studid = ? AND syid = ? AND cancelled = 0
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    paymentQuery += ' AND semid = ?';
    paymentParams.push(semid);
  }

  const [paymentRows] = await db.execute(paymentQuery, paymentParams);
  const payments = toNumber(paymentRows[0]?.amount);

  let oldPayments = 0;
  if (balClassId) {
    const oldParams = [student.id, syid, balClassId];
    let oldQuery = `
      SELECT SUM(payment) as amount
      FROM studledger
      WHERE studid = ? AND syid = ? AND classid = ? AND deleted = '0' AND payment > 0
    `;

    if (useSemesterForLevel(student.levelid) && semid) {
      oldQuery += ' AND semid = ?';
      oldParams.push(semid);
    }

    const [oldRows] = await db.execute(oldQuery, oldParams);
    oldPayments = toNumber(oldRows[0]?.amount);
  }

  const creditParams = [student.id, syid];
  let creditQuery = `
    SELECT SUM(a.amount) as amount
    FROM adjustmentdetails ad
    JOIN adjustments a ON ad.headerid = a.id
    WHERE ad.studid = ? AND a.syid = ? AND ad.deleted = '0' AND a.deleted = '0'
      AND a.iscredit = 1
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    creditQuery += ' AND a.semid = ?';
    creditParams.push(semid);
  }

  const [creditRows] = await db.execute(creditQuery, creditParams);
  const creditAdjustments = toNumber(creditRows[0]?.amount);

  return payments + oldPayments + creditAdjustments;
};

/**
 * Calculate student totals (master calculation function)
 * For Finance V1: Uses studledger-based calculation only (matching AccountsReceivableModel.php)
 *
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const calculateStudentTotals = async (db, student, syid, semid, schoolInfo, balClassId, dateRange = {}) => {
  if (!syid) {
    return {
      total_fees: 0,
      discount: 0,
      net_assessed: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };
  }

  // Finance V1 approach: studledger-only calculation
  return calculateStudentTotalsFromLedger(db, student, syid, semid, schoolInfo, dateRange);
};

// ============================================================================
// AGGREGATION & REPORTING FUNCTIONS
// ============================================================================

/**
 * Build summary statistics from student totals
 * Includes totals for assessment, discount, net assessed, payment, and
 * balance-based receivable totals to match AccountsReceivableModel.php:
 * balance = netassessed - totalpayment.
 */
const buildSummary = (studentsWithTotals) => {
  const summary = {
    total_assessment: 0,
    total_discount: 0,
    total_net_assessed: 0,
    total_payment: 0,
    total_receivable: 0,
    total_students: studentsWithTotals.length,
    students_with_balance: 0,
    average_balance: 0,
    total_overpayment: 0,
    overpaid_count: 0,
  };

  const byProgram = new Map();
  const byGradeLevel = new Map();
  let positiveBalanceTotal = 0;
  const tiers = [
    { label: '0 - 1k', min: 0, max: 1000, count: 0, total_balance: 0 },
    { label: '1k - 5k', min: 1000, max: 5000, count: 0, total_balance: 0 },
    { label: '5k - 20k', min: 5000, max: 20000, count: 0, total_balance: 0 },
    { label: '20k+', min: 20000, max: Infinity, count: 0, total_balance: 0 },
  ];

  studentsWithTotals.forEach((student) => {
    const totalFees = toNumber(student.total_fees);
    const discount = toNumber(student.discount);
    const netAssessed = toNumber(student.net_assessed);
    const totalPaid = toNumber(student.total_paid);
    const balance = toNumber(student.balance);
    const overpayment = toNumber(student.overpayment);

    // Accumulate totals (matching PHP: overalltotalassessment, overalltotaldiscount, etc.)
    summary.total_assessment += totalFees;
    summary.total_discount += discount;
    summary.total_net_assessed += netAssessed;
    summary.total_payment += totalPaid;

    const receivableAmount = balance;
    summary.total_receivable += receivableAmount;
    if (balance > 0) {
      positiveBalanceTotal += balance;
      summary.students_with_balance += 1;

      const tier = tiers.find(
        (item) => balance >= item.min && balance < item.max
      );
      if (tier) {
        tier.count += 1;
        tier.total_balance += balance;
      }
    }

    if (overpayment > 0) {
      summary.total_overpayment += overpayment;
      summary.overpaid_count += 1;
    }

    const programKey = student.acadprog_id || 'unknown';
    const programEntry = byProgram.get(programKey) || {
      program_id: student.acadprog_id || null,
      program_name: student.program_name || 'Unknown Program',
      total_balance: 0,
      student_count: 0,
    };
    programEntry.total_balance += balance;
    programEntry.student_count += 1;
    byProgram.set(programKey, programEntry);

    const levelKey = student.levelid || 'unknown';
    const levelEntry = byGradeLevel.get(levelKey) || {
      level_id: student.levelid || null,
      level_name: student.level_name || 'Unknown Level',
      total_balance: 0,
      student_count: 0,
    };
    levelEntry.total_balance += balance;
    levelEntry.student_count += 1;
    byGradeLevel.set(levelKey, levelEntry);
  });

  summary.average_balance =
    summary.students_with_balance > 0
      ? positiveBalanceTotal / summary.students_with_balance
      : 0;

  summary.total_assessment = Number(summary.total_assessment.toFixed(2));
  summary.total_discount = Number(summary.total_discount.toFixed(2));
  summary.total_net_assessed = Number(summary.total_net_assessed.toFixed(2));
  summary.total_payment = Number(summary.total_payment.toFixed(2));
  summary.total_receivable = Number(summary.total_receivable.toFixed(2));
  summary.average_balance = Number(summary.average_balance.toFixed(2));
  summary.total_overpayment = Number(summary.total_overpayment.toFixed(2));

  const programData = Array.from(byProgram.values()).map((entry) => ({
    ...entry,
    total_balance: Number(entry.total_balance.toFixed(2)),
    avg_balance:
      entry.student_count > 0
        ? Number((entry.total_balance / entry.student_count).toFixed(2))
        : 0,
  }));

  const gradeLevelData = Array.from(byGradeLevel.values()).map((entry) => ({
    ...entry,
    total_balance: Number(entry.total_balance.toFixed(2)),
    avg_balance:
      entry.student_count > 0
        ? Number((entry.total_balance / entry.student_count).toFixed(2))
        : 0,
  }));

  return {
    summary,
    byProgram: programData,
    byGradeLevel: gradeLevelData,
    balanceTiers: tiers.map((tier) => ({
      ...tier,
      total_balance: Number(tier.total_balance.toFixed(2)),
    })),
  };
};

/**
 * Fetch students with filters
 */
const fetchStudents = async (db, { syid, semid, programId, levelId, sectionId, granteeId, modeId, search }) => {
  if (!syid) {
    return [];
  }

  const searchTerm = search ? `%${search}%` : null;
  const searchClause = search
    ? ` AND (
        si.sid LIKE ?
        OR CONCAT_WS(' ', si.lastname, si.firstname, si.middlename) LIKE ?
      )`
    : '';
  const searchParams = search ? [searchTerm, searchTerm] : [];

  const [basicStudents] = await db.execute(
    `
      SELECT DISTINCT
        si.id,
        si.sid,
        si.firstname,
        si.middlename,
        si.lastname,
        s.id as section_id,
        s.sectionname as section_name,
        gl.id as levelid,
        gl.levelname as level_name,
        ap.id as acadprog_id,
        ap.progname as program_name,
        si.grantee as grantee_id,
        si.mol as mol_id
      FROM studinfo si
      JOIN enrolledstud es ON si.id = es.studid
      JOIN sections s ON si.sectionid = s.id
      JOIN gradelevel gl ON s.levelid = gl.id
      JOIN academicprogram ap ON gl.acadprogid = ap.id
      WHERE s.deleted = '0'
        AND si.deleted = '0'
        AND es.deleted = '0'
        AND si.studstatus <> '0'
        AND es.syid = ?
        ${searchClause}
    `,
    [syid, ...searchParams]
  );

  // SHS students - always query (matching PHP behavior)
  // PHP: ->where('sh_enrolledstud.semid', $selectedsemester) runs even when null
  // Laravel converts where('col', null) to WHERE col IS NULL
  let shsStudents = [];
  const shsSemClause = semid !== null && semid !== undefined
    ? 'AND sh.semid = ?'
    : 'AND sh.semid IS NULL';
  const shsSemParams = semid !== null && semid !== undefined ? [semid] : [];
  try {
    [shsStudents] = await db.execute(
      `
        SELECT DISTINCT
          si.id,
          si.sid,
          si.firstname,
          si.middlename,
          si.lastname,
          s.id as section_id,
          s.sectionname as section_name,
          gl.id as levelid,
          gl.levelname as level_name,
          ap.id as acadprog_id,
          ap.progname as program_name,
          si.grantee as grantee_id,
          si.mol as mol_id
        FROM studinfo si
        JOIN sh_enrolledstud sh ON si.id = sh.studid
        JOIN sections s ON si.sectionid = s.id
        JOIN gradelevel gl ON s.levelid = gl.id
        JOIN academicprogram ap ON gl.acadprogid = ap.id
        WHERE s.deleted = '0'
          AND si.deleted = '0'
          AND sh.deleted = '0'
          AND si.studstatus <> '0'
          AND sh.syid = ?
          ${shsSemClause}
          ${searchClause}
      `,
      [syid, ...shsSemParams, ...searchParams]
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }

  // College students - always query (matching PHP behavior)
  // PHP college query runs without semid in SQL, then filters in-memory
  let collegeStudents = [];
  try {
    const collegeParams = [syid, ...searchParams];
    let collegeSemClause = '';
    // PHP: college query has NO semid filter in SQL; it filters in-memory afterward
    // But for efficiency, if semid is set we can filter in SQL (same result)
    if (semid !== null && semid !== undefined) {
      collegeSemClause = 'AND ce.semid = ?';
      collegeParams.splice(1, 0, semid); // insert after syid
    }
    [collegeStudents] = await db.execute(
      `
        SELECT DISTINCT
          si.id,
          si.sid,
          si.firstname,
          si.middlename,
          si.lastname,
          cs.id as section_id,
          cs.sectionDesc as section_name,
          gl.id as levelid,
          gl.levelname as level_name,
          ap.id as acadprog_id,
          ap.progname as program_name,
          si.grantee as grantee_id,
          si.mol as mol_id
        FROM studinfo si
        JOIN college_enrolledstud ce ON si.id = ce.studid
        JOIN college_sections cs ON ce.sectionID = cs.id
        JOIN gradelevel gl ON cs.yearID = gl.id
        JOIN academicprogram ap ON gl.acadprogid = ap.id
        WHERE cs.deleted = '0'
          AND si.deleted = '0'
          AND ce.deleted = '0'
          AND si.studstatus <> '0'
          AND ce.syid = ?
          ${collegeSemClause}
          ${searchClause}
      `,
      collegeParams
    );
  } catch (error) {
    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
  }

  const uniqueStudents = new Map();
  [...basicStudents, ...shsStudents, ...collegeStudents].forEach((student) => {
    if (!uniqueStudents.has(student.id)) {
      uniqueStudents.set(student.id, student);
    }
  });

  let students = Array.from(uniqueStudents.values());

  if (programId) {
    const programValue = Number(programId);
    students = students.filter((student) => Number(student.acadprog_id) === programValue);
  }

  if (levelId) {
    const levelValue = Number(levelId);
    students = students.filter((student) => Number(student.levelid) === levelValue);
  }

  if (sectionId) {
    const sectionValue = Number(sectionId);
    students = students.filter((student) => Number(student.section_id) === sectionValue);
  }

  if (granteeId) {
    const granteeValue = Number(granteeId);
    students = students.filter((student) => Number(student.grantee_id) === granteeValue);
  }

  if (modeId) {
    const modeValue = Number(modeId);
    students = students.filter((student) => Number(student.mol_id) === modeValue);
  }

  students.sort((a, b) => {
    const lastA = a.lastname || '';
    const lastB = b.lastname || '';
    if (lastA !== lastB) {
      return lastA.localeCompare(lastB);
    }
    const firstA = a.firstname || '';
    const firstB = b.firstname || '';
    return firstA.localeCompare(firstB);
  });

  return students;
};

/**
 * Build school year comparison data
 */
const buildSyComparison = async (db, options) => {
  const { programId, levelId, semid, schoolInfo, balClassId } = options;
  const schoolYears = await getSchoolYears(db, 4);
  const comparison = [];

  for (const sy of schoolYears) {
    const students = await fetchStudents(db, {
      syid: sy.id,
      semid,
      programId,
      levelId,
      search: null,
    });

    let totalReceivable = 0;
    let studentsWithBalance = 0;

    for (const student of students) {
      const totals = await calculateStudentTotals(
        db,
        student,
        sy.id,
        semid,
        schoolInfo,
        balClassId
      );

      if (Number(totals.balance) <= 0) {
        continue;
      }

      totalReceivable += Number(totals.balance) || 0;
      studentsWithBalance += 1;
    }

    comparison.push({
      syid: sy.id,
      sydesc: sy.sydesc,
      total_receivable: Number(totalReceivable.toFixed(2)),
      students_with_balance: studentsWithBalance,
    });
  }

  return comparison;
};

// ============================================================================
// EXPORT FUNCTIONS - ACCOUNT RECEIVABLES
// ============================================================================

/**
 * Get filters for Account Receivables (programs and grade levels)
 */
export const getAccountReceivableFilters = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;
    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const [programs, gradeLevels, grantees, modes] = await Promise.all([
      getAcademicPrograms(db),
      getGradeLevels(db),
      getGrantees(db),
      getModesOfLearning(db),
    ]);
    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        programs,
        gradeLevels,
        grantees,
        modes,
      },
    });
  } catch (error) {
    console.error('Error fetching receivables filters:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch receivables filters',
      error: error.message,
    });
  }
};

/**
 * Get sections for Account Receivables filters based on grade level
 */
export const getAccountReceivableSections = async (req, res) => {
  try {
    const { schoolDbConfig, levelId } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    if (!levelId) {
      return res.status(200).json({
        status: 'success',
        data: [],
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const sections = await getSectionsByLevel(db, Number(levelId));
    await db.end();

    res.status(200).json({
      status: 'success',
      data: sections,
    });
  } catch (error) {
    console.error('Error fetching receivables sections:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch receivables sections',
      error: error.message,
    });
  }
};

/**
 * Get Account Receivables summary statistics (OPTIMIZED with bulk queries)
 *
 * Date filter options:
 * - dateFilter: '30days', '60days', '90days', '1year', 'custom'
 * - startDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 * - endDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 */
export const getAccountReceivableSummary = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const filters = resolveReceivableFilters(req.body);

    if (!filters.syid) {
      return res.status(400).json({
        status: 'error',
        message: 'School year is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const schoolInfo = await getSchoolInfo(db);

    const students = await fetchStudents(db, {
      syid: filters.syid,
      semid: filters.semid,
      programId: filters.programId,
      levelId: filters.levelId,
      sectionId: filters.sectionId,
      granteeId: filters.granteeId,
      modeId: filters.modeId,
      search: null,
    });

    // Use optimized bulk query for studledger calculations
    const studentsWithTotals = await getStudentsWithBalancesBulk(
      db,
      students,
      filters.syid,
      filters.semid,
      schoolInfo,
      filters.dateRange
    );

    const aggregated = buildSummary(studentsWithTotals);

    // Skip bySchoolYear comparison for now (it's slow and optional)
    // Can be loaded separately if needed
    const bySchoolYear = [];

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        ...aggregated,
        bySchoolYear,
        appliedDateRange: filters.dateRange,
      },
    });
  } catch (error) {
    console.error('Error fetching receivables summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch receivables summary',
      error: error.message,
    });
  }
};

/**
 * Get Account Receivables detailed list
 *
 * Date filter options:
 * - dateFilter: '30days', '60days', '90days', '1year', 'custom'
 * - startDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 * - endDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 */
export const getAccountReceivableList = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const filters = resolveReceivableFilters(req.body);
    const page = filters.page ?? 1;
    const perPage = filters.perPage ?? 200;

    if (!filters.syid) {
      return res.status(400).json({
        status: 'error',
        message: 'School year is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);
    const schoolInfo = await getSchoolInfo(db);

    const students = await fetchStudents(db, {
      syid: filters.syid,
      semid: filters.semid,
      programId: filters.programId,
      levelId: filters.levelId,
      sectionId: filters.sectionId,
      granteeId: filters.granteeId,
      modeId: filters.modeId,
      search: filters.search,
    });

    const studentsWithTotals = await getStudentsWithBalancesBulk(
      db,
      students,
      filters.syid,
      filters.semid,
      schoolInfo,
      filters.dateRange
    );

    const listRows = studentsWithTotals.map((student) => {
      const lastName = student.lastname || '';
      const firstMiddle = [student.firstname, student.middlename].filter(Boolean).join(' ');
      const fullName =
        student.full_name ||
        [lastName, firstMiddle].filter(Boolean).join(', ').trim() ||
        student.sid ||
        'Unknown';

      return {
        id: student.id,
        sid: student.sid,
        full_name: fullName,
        name: fullName,
        level_name: student.level_name,
        program_name: student.program_name,
        total_fees: student.total_fees,
        discount: student.discount,
        net_assessed: student.net_assessed,
        total_paid: student.total_paid,
        balance: student.balance,
        overpayment: student.overpayment,
      };
    });

    const pageSize = Number(perPage);
    const usePaging = Number.isFinite(pageSize) && pageSize > 0;
    const currentPage = usePaging ? Math.max(1, Number(page) || 1) : 1;
    const startIndex = usePaging ? (currentPage - 1) * pageSize : 0;
    const endIndex = usePaging ? startIndex + pageSize : listRows.length;
    const paginatedStudents = usePaging ? listRows.slice(startIndex, endIndex) : listRows;
    const pageCount = usePaging ? Math.max(1, Math.ceil(listRows.length / pageSize)) : 1;
    const perPageValue = usePaging ? pageSize : listRows.length;

    await db.end();

    res.status(200).json({
      status: 'success',
      data: paginatedStudents,
      meta: {
        total: listRows.length,
        page: currentPage,
        per_page: perPageValue,
        pages: pageCount,
        appliedDateRange: filters.dateRange,
      },
    });
  } catch (error) {
    console.error('Error fetching receivables list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch receivables list',
      error: error.message,
    });
  }
};

// ============================================================================
// EXPORT FUNCTIONS - CASHIER TRANSACTIONS
// ============================================================================

/**
 * Get cashier summary statistics
 */
export const getCashierSummary = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      startDate,
      endDate,
      paymentTypeId,
      terminalId,
      status,
    } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    const baseParams = [];
    const extraFilters = [];
    const extraParams = [];

    // The legacy v1 cashier report filters by date/terminal/payment type only.
    // syid/semid are intentionally not applied here because older v1 cashier
    // transactions are not consistently tagged by active school year/semester.
    if (startDate) {
      extraFilters.push('DATE(t.transdate) >= ?');
      extraParams.push(startDate);
    }

    if (endDate) {
      extraFilters.push('DATE(t.transdate) <= ?');
      extraParams.push(endDate);
    }

    if (paymentTypeId) {
      extraFilters.push('pt.id = ?');
      extraParams.push(paymentTypeId);
    }

    if (terminalId) {
      extraFilters.push('t.terminalno = ?');
      extraParams.push(terminalId);
    }

    let statusClause = '';
    if (status === 'posted') {
      statusClause = ' AND t.cancelled = 0 AND t.posted = 1';
    } else if (status === 'cancelled') {
      statusClause = ' AND t.cancelled = 1';
    } else if (status === 'pending') {
      statusClause = ' AND t.cancelled = 0 AND (t.posted = 0 OR t.posted IS NULL)';
    }

    const breakdownStatusClause = statusClause || ' AND t.cancelled = 0';
    const extraClause = extraFilters.length ? ` AND ${extraFilters.join(' AND ')}` : '';

    // Get total transactions and amounts
    const [totalStats] = await db.execute(
      `SELECT
        COUNT(*) as total_transactions,
        SUM(IFNULL(t.amountpaid, 0)) as total_collections,
        SUM(CASE WHEN t.cancelled = 1 THEN IFNULL(t.amountpaid, 0) ELSE 0 END) as cancelled_amount,
        SUM(CASE WHEN cancelled = 1 THEN 1 ELSE 0 END) as cancelled_count,
        SUM(
          CASE
            WHEN cancelled = 0
              AND IFNULL(amountpaid, 0) > IFNULL(totalamount, 0)
              THEN IFNULL(amountpaid, 0) - IFNULL(totalamount, 0)
            ELSE 0
          END
        ) as overpayment_amount,
        SUM(
          CASE
            WHEN cancelled = 0
              AND IFNULL(amountpaid, 0) > IFNULL(totalamount, 0)
              THEN 1
            ELSE 0
          END
        ) as overpayment_count
      FROM chrngtrans t
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      WHERE 1=1${statusClause}${extraClause}`,
      [...baseParams, ...extraParams]
    );

    // Get collections by payment type
    const [byPaymentType] = await db.execute(
      `SELECT
        COALESCE(pt.description, t.paytype, 'N/A') as payment_type,
        COUNT(t.id) as transaction_count,
        SUM(IFNULL(t.amountpaid, 0)) as total_amount
      FROM chrngtrans t
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      WHERE 1=1${breakdownStatusClause}${extraClause}
      GROUP BY COALESCE(pt.description, t.paytype, 'N/A')
      ORDER BY total_amount DESC`,
      [...baseParams, ...extraParams]
    );

    // Get collections by item classification
    const [byClassification] = await db.execute(
      `SELECT
        ic.description as classification,
        COUNT(DISTINCT ti.chrngtransid) as transaction_count,
        SUM(ti.amount) as total_amount
      FROM chrngtransdetail ti
      LEFT JOIN itemclassification ic ON ti.classid = ic.id
      LEFT JOIN chrngtrans t ON ti.chrngtransid = t.id
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      WHERE 1=1${breakdownStatusClause}${extraClause}
      GROUP BY ti.classid, ic.description
      ORDER BY total_amount DESC`,
      [...baseParams, ...extraParams]
    );

    // Get collections by terminal
    const [byTerminal] = await db.execute(
      `SELECT
        term.description as terminal,
        term.owner as cashier,
        COUNT(t.id) as transaction_count,
        SUM(IFNULL(t.amountpaid, 0)) as total_amount
      FROM chrngtrans t
      LEFT JOIN chrngterminals term ON t.terminalno = term.id
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      WHERE 1=1${breakdownStatusClause}${extraClause}
      GROUP BY t.terminalno, term.description, term.owner
      ORDER BY total_amount DESC`,
      [...baseParams, ...extraParams]
    );

    // Get daily collections for the last 7 days
    const [dailyCollections] = await db.execute(
      `SELECT
        DATE(t.transdate) as date,
        COUNT(t.id) as transaction_count,
        SUM(IFNULL(t.amountpaid, 0)) as total_amount
      FROM chrngtrans t
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      WHERE 1=1${breakdownStatusClause}
        AND t.transdate >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)${extraClause}
      GROUP BY DATE(t.transdate)
      ORDER BY date DESC`,
      [...baseParams, ...extraParams]
    );

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        summary: totalStats[0],
        byPaymentType,
        byClassification,
        byTerminal,
        dailyCollections,
      },
    });
  } catch (error) {
    console.error('Error fetching cashier summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch cashier summary',
      error: error.message,
    });
  }
};

/**
 * Get transaction list
 */
export const getTransactionList = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      startDate,
      endDate,
      paymentTypeId,
      terminalId,
      status,
    } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    let query = `
      SELECT
        t.id,
        t.ornum,
        t.transdate,
        t.studid,
        s.sid as sid,
        TRIM(CONCAT_WS(' ', s.firstname, s.middlename, s.lastname)) as full_name,
        t.studname,
        t.glevel as grade_level,
        t.amountpaid as totalamount,
        t.totalamount as original_totalamount,
        t.amountpaid,
        t.amounttendered,
        NULL as change_amount,
        COALESCE(pt.description, t.paytype, 'N/A') as payment_type,
        term.description as terminal,
        term.owner as cashier,
        t.transby,
        COALESCE(u.name, TRIM(CONCAT_WS(' ', tr.lastname, tr.firstname, tr.middlename))) as transacted_by,
        t.cancelled,
        t.cancelledremarks,
        t.posted,
        GROUP_CONCAT(DISTINCT ic.description ORDER BY ic.description SEPARATOR ', ') as items
      FROM chrngtrans t
      LEFT JOIN studinfo s ON t.studid = s.id
      LEFT JOIN users u ON t.transby = u.id
      LEFT JOIN teacher tr ON t.transby = tr.userid
      LEFT JOIN chrngterminals term ON t.terminalno = term.id
      LEFT JOIN paymenttype pt ON t.paytype = pt.description
      LEFT JOIN chrngtransdetail ti ON t.id = ti.chrngtransid
      LEFT JOIN itemclassification ic ON ti.classid = ic.id
      WHERE 1=1
    `;

    const params = [];

    if (startDate) {
      query += ` AND DATE(t.transdate) >= ?`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND DATE(t.transdate) <= ?`;
      params.push(endDate);
    }

    if (paymentTypeId) {
      query += ` AND pt.id = ?`;
      params.push(paymentTypeId);
    }

    if (terminalId) {
      query += ` AND t.terminalno = ?`;
      params.push(terminalId);
    }

    if (status === 'posted') {
      query += ` AND t.cancelled = 0 AND t.posted = 1`;
    } else if (status === 'cancelled') {
      query += ` AND t.cancelled = 1`;
    } else if (status === 'pending') {
      query += ` AND t.cancelled = 0 AND (t.posted = 0 OR t.posted IS NULL)`;
    }

    query += `
      GROUP BY t.id, t.ornum, t.transdate, t.studid, s.sid, s.firstname, s.middlename, s.lastname,
               t.studname, t.glevel, t.transby, u.name, tr.lastname, tr.firstname, tr.middlename,
               t.totalamount, t.amountpaid, t.amounttendered,
               pt.description, t.paytype, term.description, term.owner, t.cancelled, t.cancelledremarks, t.posted
      ORDER BY t.ornum ASC
    `;

    const [transactions] = await db.execute(query, params);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: transactions,
    });
  } catch (error) {
    console.error('Error fetching transaction list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch transaction list',
      error: error.message,
    });
  }
};

/**
 * Get payment types
 */
export const getPaymentTypes = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    const [paymentTypes] = await db.execute(
      'SELECT * FROM paymenttype WHERE deleted = \'0\' ORDER BY id'
    );

    await db.end();

    res.status(200).json({
      status: 'success',
      data: paymentTypes,
    });
  } catch (error) {
    console.error('Error fetching payment types:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch payment types',
      error: error.message,
    });
  }
};

/**
 * Get terminals
 */
export const getTerminals = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const db = await getSchoolConnection(schoolDbConfig);

    const [terminals] = await db.execute(
      'SELECT * FROM chrngterminals ORDER BY id'
    );

    await db.end();

    res.status(200).json({
      status: 'success',
      data: terminals,
    });
  } catch (error) {
    console.error('Error fetching terminals:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch terminals',
      error: error.message,
    });
  }
};

// ============================================================================
// EXPORT FUNCTIONS - DAILY CASH PROGRESS
// ============================================================================

/**
 * Helper functions for Daily Cash Progress
 */
const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    return formatDateInput(value);
  }
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  return String(value);
};

const resolveDateRange = ({ date, startDate, endDate }) => {
  const today = new Date();
  if (date) {
    return { resolvedStart: date, resolvedEnd: date };
  }
  const resolvedStart = startDate || formatDateInput(today);
  const resolvedEnd = endDate || formatDateInput(today);
  return { resolvedStart, resolvedEnd };
};

const buildProcessedPayments = (rows) => {
  const transactions = new Map();

  rows.forEach((row) => {
    const transactionKey = row.transaction_key || row.ornum || row.transno;
    const sourceTransno = row.transno || transactionKey;

    if (!transactions.has(transactionKey)) {
      transactions.set(transactionKey, {
        transno: transactionKey,
        ornum: row.ornum,
        transdate: row.transdate,
        trans_day: normalizeDateKey(row.trans_day),
        amountpaid: 0,
        payment_type: row.payment_type || 'N/A',
        paymenttype_id: row.paymenttype_id || null,
        paidTransnos: new Set(),
        items: [],
      });
    }

    const transaction = transactions.get(transactionKey);
    if (!transaction.paidTransnos.has(sourceTransno)) {
      transaction.amountpaid += toNumber(row.amountpaid);
      transaction.paidTransnos.add(sourceTransno);
    }

    transaction.items.push({
      transno: transactionKey,
      source_transno: sourceTransno,
      ornum: row.ornum,
      transdate: row.transdate,
      trans_day: normalizeDateKey(row.trans_day),
      studid: row.studid,
      sid: row.sid,
      student_name: row.student_name,
      classid: row.classid,
      classification: row.classification,
      particulars: row.particulars,
      amount: toNumber(row.amount),
      payment_type: row.payment_type || 'N/A',
    });
  });

  const processedItems = [];
  let totalOverpayment = 0;
  let overpaymentCount = 0;

  transactions.forEach((transaction) => {
    const itemsTotal = transaction.items.reduce(
      (sum, item) => sum + toNumber(item.amount),
      0
    );
    // Note: v1 schools don't have change_amount, so overpayment calculation is simpler
    const overpayment = Math.max(
      0,
      toNumber(transaction.amountpaid) - itemsTotal
    );

    if (overpayment > 0) {
      totalOverpayment += overpayment;
      overpaymentCount += 1;
    }

    let firstItem = true;
    transaction.items.forEach((item) => {
      const itemOverpayment = firstItem ? overpayment : 0;
      processedItems.push({
        ...item,
        paid_amount: toNumber(item.amount) + itemOverpayment,
        overpayment: itemOverpayment,
      });
      firstItem = false;
    });
  });

  return {
    transactions,
    processedItems,
    totalOverpayment,
    overpaymentCount,
  };
};

const buildDailyCashSummary = ({ transactions, processedItems, totalOverpayment, overpaymentCount }) => {
  const totalCollections = processedItems.reduce(
    (sum, item) => sum + toNumber(item.paid_amount),
    0
  );
  const totalItems = processedItems.length;
  const totalTransactions = transactions.size;

  return {
    total_collections: Number(totalCollections.toFixed(2)),
    total_transactions: totalTransactions,
    total_items: totalItems,
    total_overpayment: Number(totalOverpayment.toFixed(2)),
    overpayment_count: overpaymentCount,
    average_per_transaction:
      totalTransactions > 0 ? Number((totalCollections / totalTransactions).toFixed(2)) : 0,
    average_per_item: totalItems > 0 ? Number((totalCollections / totalItems).toFixed(2)) : 0,
  };
};

const buildDailyCashAggregations = ({ transactions, processedItems }) => {
  const byDayMap = new Map();
  const byClassMap = new Map();
  const byPaymentTypeMap = new Map();

  processedItems.forEach((item) => {
    const dayKey = item.trans_day;
    if (!byDayMap.has(dayKey)) {
      byDayMap.set(dayKey, {
        date: dayKey,
        total_amount: 0,
        item_count: 0,
        transaction_ids: new Set(),
        overpayment_amount: 0,
      });
    }

    const dayEntry = byDayMap.get(dayKey);
    dayEntry.total_amount += toNumber(item.paid_amount);
    dayEntry.item_count += 1;
    dayEntry.transaction_ids.add(item.transno);
    if (toNumber(item.overpayment) > 0) {
      dayEntry.overpayment_amount += toNumber(item.overpayment);
    }

    const classKey = item.classid || item.particulars || 'uncategorized';
    if (!byClassMap.has(classKey)) {
      byClassMap.set(classKey, {
        classid: item.classid,
        classification: item.classification || item.particulars || 'Uncategorized',
        total_amount: 0,
        item_count: 0,
      });
    }
    const classEntry = byClassMap.get(classKey);
    classEntry.total_amount += toNumber(item.paid_amount);
    classEntry.item_count += 1;

    const typeKey = item.payment_type || 'N/A';
    if (!byPaymentTypeMap.has(typeKey)) {
      byPaymentTypeMap.set(typeKey, {
        payment_type: typeKey,
        total_amount: 0,
        transaction_ids: new Set(),
      });
    }
    const typeEntry = byPaymentTypeMap.get(typeKey);
    typeEntry.total_amount += toNumber(item.paid_amount);
    typeEntry.transaction_ids.add(item.transno);
  });

  const byDay = Array.from(byDayMap.values())
    .map((entry) => ({
      date: entry.date,
      total_amount: Number(entry.total_amount.toFixed(2)),
      item_count: entry.item_count,
      transaction_count: entry.transaction_ids.size,
      overpayment_amount: Number(entry.overpayment_amount.toFixed(2)),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const byClassification = Array.from(byClassMap.values())
    .map((entry) => ({
      ...entry,
      total_amount: Number(entry.total_amount.toFixed(2)),
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  const byPaymentType = Array.from(byPaymentTypeMap.values())
    .map((entry) => ({
      payment_type: entry.payment_type,
      total_amount: Number(entry.total_amount.toFixed(2)),
      transaction_count: entry.transaction_ids.size,
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  return { byDay, byClassification, byPaymentType };
};

const normalizeV1ParticularsExpression = `
  CASE
    WHEN cct.particulars LIKE '%TUITION%' THEN 'TUITION'
    WHEN cct.particulars LIKE '%Balance forwarded from SY%' THEN 'BALANCE FORWARDED'
    ELSE cct.particulars
  END
`;

const normalizeV1LedgerParticularsExpression = `
  CASE
    WHEN ledger_item.particulars LIKE '%TUITION%' THEN 'TUITION'
    WHEN ledger_item.particulars LIKE '%Balance forwarded from SY%' THEN 'BALANCE FORWARDED'
    WHEN ledger_item.particulars IS NOT NULL THEN ledger_item.particulars
    WHEN slp.particulars LIKE 'PAYMENT FOR % - OR:%' THEN TRIM(SUBSTRING_INDEX(SUBSTRING(slp.particulars, 13), ' - OR:', 1))
    ELSE 'Unclassified Payment'
  END
`;

const buildCollectionFilter = ({ paymentTypeId, status, syid }, tableAlias = 'ct') => {
  const params = [];
  let clause = '';

  const resolvedStatus = status && status !== 'all' ? status : null;
  if (resolvedStatus === 'posted') {
    clause += ` AND ${tableAlias}.posted = 1`;
  } else if (resolvedStatus === 'pending') {
    clause += ` AND (${tableAlias}.posted = 0 OR ${tableAlias}.posted IS NULL)`;
  }

  if (paymentTypeId) {
    clause += ' AND pt.id = ?';
    params.push(paymentTypeId);
  }

  if (syid) {
    clause += ` AND ${tableAlias}.syid = ?`;
    params.push(syid);
  }

  return { clause, params };
};

const fetchDailyCashRows = async (db, { startDate, endDate, paymentTypeId, status, syid }) => {
  const filter = buildCollectionFilter({ paymentTypeId, status, syid }, 'ct');
  const dateParams = [startDate, endDate];

  const cashRowsQuery = `
    SELECT
      COALESCE(ct.ornum, ct.transno) as transaction_key,
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE_FORMAT(ct.transdate, '%Y-%m-%d') as trans_day,
      ct.amountpaid,
      pt.id as paymenttype_id,
      COALESCE(pt.description, ct.paytype, 'N/A') as payment_type,
      ct.studid,
      s.sid,
      COALESCE(ct.studname, TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename))) as student_name,
      ${normalizeV1ParticularsExpression} as classid,
      ${normalizeV1ParticularsExpression} as classification,
      cct.particulars,
      cct.amount
    FROM chrngtrans ct
    JOIN chrngcashtrans cct ON ct.transno = cct.transno
    LEFT JOIN paymenttype pt ON ct.paytype = pt.description
    LEFT JOIN studinfo s ON ct.studid = s.id
    WHERE ct.cancelled = 0
      AND cct.deleted = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
      ${filter.clause}
  `;

  const detailRowsQuery = `
    SELECT
      COALESCE(ct.ornum, ct.transno) as transaction_key,
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE_FORMAT(ct.transdate, '%Y-%m-%d') as trans_day,
      ct.amountpaid,
      pt.id as paymenttype_id,
      COALESCE(pt.description, ct.paytype, 'N/A') as payment_type,
      ct.studid,
      s.sid,
      COALESCE(ct.studname, TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename))) as student_name,
      COALESCE(ctd.classid, ctd.items, 'Unspecified') as classid,
      CASE
        WHEN ctd.items LIKE '%TUITION%' THEN 'TUITION'
        WHEN ctd.items LIKE '%Balance forwarded from SY%' THEN 'BALANCE FORWARDED'
        ELSE COALESCE(ic.description, ctd.items, 'Unspecified')
      END as classification,
      COALESCE(ctd.items, ic.description, 'Unspecified') as particulars,
      ctd.amount
    FROM chrngtrans ct
    JOIN chrngtransdetail ctd ON ct.id = ctd.chrngtransid
    LEFT JOIN itemclassification ic ON ctd.classid = ic.id
    LEFT JOIN paymenttype pt ON ct.paytype = pt.description
    LEFT JOIN studinfo s ON ct.studid = s.id
    WHERE ct.cancelled = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
      ${filter.clause}
      AND NOT EXISTS (
        SELECT 1
        FROM chrngcashtrans cct
        WHERE cct.transno = ct.transno
          AND cct.deleted = 0
      )
  `;

  const transItemsRowsQuery = `
    SELECT
      COALESCE(ct.ornum, ct.transno) as transaction_key,
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE_FORMAT(ct.transdate, '%Y-%m-%d') as trans_day,
      ct.amountpaid,
      pt.id as paymenttype_id,
      COALESCE(pt.description, ct.paytype, 'N/A') as payment_type,
      ct.studid,
      s.sid,
      COALESCE(ct.studname, TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename))) as student_name,
      COALESCE(cti.classid, ic.description, 'Unspecified') as classid,
      CASE
        WHEN ic.description LIKE '%TUITION%' THEN 'TUITION'
        WHEN ic.description LIKE '%Balance forwarded from SY%' THEN 'BALANCE FORWARDED'
        ELSE COALESCE(ic.description, 'Unspecified')
      END as classification,
      COALESCE(ic.description, 'Unspecified') as particulars,
      cti.amount
    FROM chrngtrans ct
    JOIN chrngtransitems cti ON ct.id = cti.chrngtransid
    LEFT JOIN itemclassification ic ON cti.classid = ic.id
    LEFT JOIN paymenttype pt ON ct.paytype = pt.description
    LEFT JOIN studinfo s ON ct.studid = s.id
    WHERE ct.cancelled = 0
      AND cti.deleted = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
      ${filter.clause}
      AND NOT EXISTS (
        SELECT 1
        FROM chrngcashtrans cct
        WHERE cct.transno = ct.transno
          AND cct.deleted = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM chrngtransdetail ctd
        WHERE ctd.chrngtransid = ct.id
      )
  `;

  const ledgerFallbackQuery = `
    SELECT
      COALESCE(ct.ornum, ct.transno) as transaction_key,
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE_FORMAT(ct.transdate, '%Y-%m-%d') as trans_day,
      ct.amountpaid,
      pt.id as paymenttype_id,
      COALESCE(pt.description, ct.paytype, 'N/A') as payment_type,
      ct.studid,
      s.sid,
      COALESCE(ct.studname, TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename))) as student_name,
      COALESCE(ledger_item.classid, CONCAT('ledger-', ct.id)) as classid,
      ${normalizeV1LedgerParticularsExpression} as classification,
      ${normalizeV1LedgerParticularsExpression} as particulars,
      ct.amountpaid as amount
    FROM chrngtrans ct
    LEFT JOIN paymenttype pt ON ct.paytype = pt.description
    LEFT JOIN studinfo s ON ct.studid = s.id
    LEFT JOIN studledger slp
      ON slp.id = (
        SELECT slp_one.id
        FROM studledger slp_one
        WHERE slp_one.transid = ct.id
          AND slp_one.ornum = ct.ornum
          AND slp_one.payment > 0
          AND slp_one.deleted = 0
          AND slp_one.void = 0
        ORDER BY slp_one.id DESC
        LIMIT 1
      )
    LEFT JOIN studledger ledger_item
      ON ledger_item.id = (
        SELECT sli.id
        FROM studledger sli
        WHERE sli.studid = ct.studid
          AND sli.syid = ct.syid
          AND sli.deleted = 0
          AND sli.void = 0
          AND sli.amount > 0
          AND sli.payment = 0
        ORDER BY
          CASE
            WHEN slp.particulars LIKE '%OTHER FEES%' AND sli.classid IS NOT NULL THEN 0
            WHEN sli.classid IS NOT NULL THEN 1
            ELSE 2
          END,
          sli.createddatetime DESC,
          sli.id DESC
        LIMIT 1
      )
    WHERE ct.cancelled = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
      ${filter.clause}
      AND NOT EXISTS (
        SELECT 1
        FROM chrngcashtrans cct
        WHERE cct.transno = ct.transno
          AND cct.deleted = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM chrngtransdetail ctd
        WHERE ctd.chrngtransid = ct.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM chrngtransitems cti
        WHERE cti.chrngtransid = ct.id
          AND cti.deleted = 0
      )
      AND NOT EXISTS (
        SELECT 1
        FROM chrngtrans sibling
        WHERE sibling.id <> ct.id
          AND sibling.cancelled = 0
          AND sibling.studid = ct.studid
          AND COALESCE(sibling.ornum, sibling.transno) = COALESCE(ct.ornum, ct.transno)
          AND DATE(sibling.transdate) = DATE(ct.transdate)
          AND (
            EXISTS (
              SELECT 1
              FROM chrngcashtrans sibling_cash
              WHERE sibling_cash.transno = sibling.transno
                AND sibling_cash.deleted = 0
            )
            OR EXISTS (
              SELECT 1
              FROM chrngtransdetail sibling_detail
              WHERE sibling_detail.chrngtransid = sibling.id
            )
            OR EXISTS (
              SELECT 1
              FROM chrngtransitems sibling_item
              WHERE sibling_item.chrngtransid = sibling.id
                AND sibling_item.deleted = 0
            )
          )
      )
  `;

  const query = `
    ${cashRowsQuery}
    UNION ALL
    ${detailRowsQuery}
    UNION ALL
    ${transItemsRowsQuery}
    UNION ALL
    ${ledgerFallbackQuery}
    ORDER BY ornum ASC, transdate ASC
  `;

  const params = [
    ...dateParams,
    ...filter.params,
    ...dateParams,
    ...filter.params,
    ...dateParams,
    ...filter.params,
    ...dateParams,
    ...filter.params,
  ];

  const [rows] = await db.execute(query, params);

  if (rows.length > 0) {
    return rows;
  }

  // If every transaction is missing item rows, still return a payment-only row
  // instead of an empty report.
  let paymentOnlyQuery = `
    SELECT
      COALESCE(ct.ornum, ct.transno) as transaction_key,
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE_FORMAT(ct.transdate, '%Y-%m-%d') as trans_day,
      ct.amountpaid,
      pt.id as paymenttype_id,
      COALESCE(pt.description, ct.paytype, 'N/A') as payment_type,
      ct.studid,
      s.sid,
      COALESCE(ct.studname, TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename))) as student_name,
      CONCAT('payment-', ct.id) as classid,
      'Unclassified Payment' as classification,
      'Unclassified Payment' as particulars,
      ct.amountpaid as amount
    FROM chrngtrans ct
    LEFT JOIN paymenttype pt ON ct.paytype = pt.description
    LEFT JOIN studinfo s ON ct.studid = s.id
    WHERE ct.cancelled = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
  `;

  const paymentOnlyParams = [startDate, endDate];
  paymentOnlyQuery += filter.clause;
  paymentOnlyParams.push(...filter.params);
  paymentOnlyQuery += `
      AND NOT EXISTS (
        SELECT 1
        FROM chrngtrans sibling
        WHERE sibling.id <> ct.id
          AND sibling.cancelled = 0
          AND sibling.studid = ct.studid
          AND COALESCE(sibling.ornum, sibling.transno) = COALESCE(ct.ornum, ct.transno)
          AND DATE(sibling.transdate) = DATE(ct.transdate)
          AND (
            EXISTS (
              SELECT 1
              FROM chrngcashtrans sibling_cash
              WHERE sibling_cash.transno = sibling.transno
                AND sibling_cash.deleted = 0
            )
            OR EXISTS (
              SELECT 1
              FROM chrngtransdetail sibling_detail
              WHERE sibling_detail.chrngtransid = sibling.id
            )
            OR EXISTS (
              SELECT 1
              FROM chrngtransitems sibling_item
              WHERE sibling_item.chrngtransid = sibling.id
                AND sibling_item.deleted = 0
            )
          )
      )
  `;

  paymentOnlyQuery += ' ORDER BY ct.ornum ASC, ct.transdate ASC';

  const [paymentOnlyRows] = await db.execute(paymentOnlyQuery, paymentOnlyParams);
  return paymentOnlyRows;
};

/**
 * Get daily cash summary
 */
export const getDailyCashSummary = async (req, res) => {
  try {
    const { schoolDbConfig, date, startDate, endDate, paymentTypeId } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const { resolvedStart, resolvedEnd } = resolveDateRange({ date, startDate, endDate });
    const db = await getSchoolConnection(schoolDbConfig);

    const rows = await fetchDailyCashRows(db, {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      paymentTypeId,
    });

    const processed = buildProcessedPayments(rows);
    const summary = buildDailyCashSummary(processed);
    const aggregations = buildDailyCashAggregations(processed);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        summary,
        ...aggregations,
      },
    });
  } catch (error) {
    console.error('Error fetching daily cash summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch daily cash summary',
      error: error.message,
    });
  }
};

/**
 * Get daily cash items
 */
export const getDailyCashItems = async (req, res) => {
  try {
    const { schoolDbConfig, date, startDate, endDate, paymentTypeId } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const { resolvedStart, resolvedEnd } = resolveDateRange({ date, startDate, endDate });
    const db = await getSchoolConnection(schoolDbConfig);

    const rows = await fetchDailyCashRows(db, {
      startDate: resolvedStart,
      endDate: resolvedEnd,
      paymentTypeId,
    });

    const processed = buildProcessedPayments(rows);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: processed.processedItems,
    });
  } catch (error) {
    console.error('Error fetching daily cash items:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch daily cash items',
      error: error.message,
    });
  }
};

// ============================================================================
// EXPORT FUNCTIONS - MONTHLY SUMMARY
// ============================================================================

/**
 * Helper functions for summaries
 */
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

const buildSummaryFilters = ({ startDate, endDate, paymentTypeId, status }) => {
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

  // Note: v1 databases don't have paymenttype_id column
  // Payment type filtering is not supported for v1 schools
  // if (paymentTypeId) {
  //   clause += ' AND t.paymenttype_id = ?';
  //   params.push(paymentTypeId);
  // }

  return { clause, params };
};

// Note: v1 uses chrngtransdetail, v0 uses chrngcashtrans
// Note: v1 chrngtransdetail doesn't have particulars column, only uses classification
const normalizeItemLabel = "COALESCE(ic.description, 'Unspecified')";

const buildCollectionSummaryData = (rows) => {
  const processed = buildProcessedPayments(rows);
  const byItemMap = new Map();
  const byMonthMap = new Map();
  let totalCollections = 0;

  processed.transactions.forEach((transaction) => {
    const amountPaid = toNumber(transaction.amountpaid);
    totalCollections += amountPaid;

    const monthKey = normalizeDateKey(transaction.transdate || transaction.trans_day).slice(0, 7);
    if (!monthKey) return;

    if (!byMonthMap.has(monthKey)) {
      byMonthMap.set(monthKey, {
        month_key: monthKey,
        total_amount: 0,
        transaction_ids: new Set(),
      });
    }

    const monthEntry = byMonthMap.get(monthKey);
    monthEntry.total_amount += amountPaid;
    monthEntry.transaction_ids.add(transaction.transno);
  });

  processed.processedItems.forEach((item) => {
    const itemLabel = item.classification || item.particulars || 'Unspecified';
    if (!byItemMap.has(itemLabel)) {
      byItemMap.set(itemLabel, {
        item: itemLabel,
        total_amount: 0,
        transaction_ids: new Set(),
      });
    }
    const itemEntry = byItemMap.get(itemLabel);
    itemEntry.total_amount += toNumber(item.paid_amount);
    itemEntry.transaction_ids.add(item.transno);
  });

  const byItem = Array.from(byItemMap.values())
    .map((entry) => ({
      item: entry.item,
      total_amount: Number(entry.total_amount.toFixed(2)),
      transaction_count: entry.transaction_ids.size,
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  const byMonth = Array.from(byMonthMap.values())
    .map((entry) => ({
      month_key: entry.month_key,
      total_amount: Number(entry.total_amount.toFixed(2)),
      transaction_count: entry.transaction_ids.size,
      month_label: formatMonthLabel(entry.month_key),
    }))
    .sort((a, b) => a.month_key.localeCompare(b.month_key));

  return {
    processed,
    summary: {
      transaction_count: processed.transactions.size,
      line_count: processed.processedItems.length,
      item_count: byItem.length,
      total_amount: Number(totalCollections.toFixed(2)),
    },
    byItem,
    byMonth,
  };
};

const buildYearlyTableData = (processedItems) => {
  const itemMap = new Map();
  const monthSet = new Set();

  processedItems.forEach((item) => {
    const itemLabel = item.classification || item.particulars || 'Unspecified';
    const monthKey = normalizeDateKey(item.transdate || item.trans_day).slice(0, 7);
    const amount = toNumber(item.paid_amount);

    if (!monthKey) return;

    monthSet.add(monthKey);

    if (!itemMap.has(itemLabel)) {
      itemMap.set(itemLabel, {
        item: itemLabel,
        monthly: {},
        total_amount: 0,
      });
    }

    const itemData = itemMap.get(itemLabel);
    itemData.monthly[monthKey] = toNumber(itemData.monthly[monthKey]) + amount;
    itemData.total_amount += amount;
  });

  const months = Array.from(monthSet)
    .sort()
    .map((key) => ({ key, label: formatMonthLabel(key) }));

  const items = Array.from(itemMap.values())
    .map((item) => ({
      ...item,
      monthly: Object.fromEntries(
        Object.entries(item.monthly).map(([key, value]) => [key, Number(toNumber(value).toFixed(2))])
      ),
      total_amount: Number(item.total_amount.toFixed(2)),
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  return { months, items };
};

const resolveSchoolYearCollectionRange = async (db, syid, syStart, syEnd) => {
  const [rangeRows] = await db.execute(
    `
      SELECT
        MIN(DATE(transdate)) as min_date,
        MAX(DATE(transdate)) as max_date
      FROM chrngtrans
      WHERE syid = ? AND cancelled = 0
    `,
    [syid]
  );

  const maxDate = parseDateOnly(rangeRows[0]?.max_date);

  const resolvedEnd =
    maxDate && maxDate > syEnd ? maxDate : syEnd;

  return {
    startDate: formatDateKey(syStart),
    endDate: formatDateKey(resolvedEnd),
  };
};

/**
 * Get monthly summary
 */
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
    const rows = await fetchDailyCashRows(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
    });

    const { summary, byItem, byMonth } = buildCollectionSummaryData(rows);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        summary,
        byItem,
        byMonth,
      },
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

/**
 * Get monthly summary items
 */
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
    const rows = await fetchDailyCashRows(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
    });
    const { byItem } = buildCollectionSummaryData(rows);

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

// ============================================================================
// EXPORT FUNCTIONS - YEARLY SUMMARY
// ============================================================================

/**
 * Get yearly summary
 */
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
    const syStart = parseDateOnly(schoolYear.sdate);
    const syEnd = parseDateOnly(schoolYear.edate);

    if (!syStart || !syEnd) {
      await db.end();
      return res.status(400).json({
        status: 'error',
        message: 'School year date range is invalid',
      });
    }

    const { startDate, endDate } = await resolveSchoolYearCollectionRange(db, syid, syStart, syEnd);
    const rows = await fetchDailyCashRows(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
      syid,
    });
    const { summary, byMonth, byItem } = buildCollectionSummaryData(rows);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        schoolYear: {
          id: schoolYear.id,
          sydesc: schoolYear.sydesc,
          startDate,
          endDate,
        },
        summary,
        byMonth,
        byItem,
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

/**
 * Get yearly summary table
 */
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
    const syStart = parseDateOnly(schoolYear.sdate);
    const syEnd = parseDateOnly(schoolYear.edate);

    if (!syStart || !syEnd) {
      await db.end();
      return res.status(400).json({
        status: 'error',
        message: 'School year date range is invalid',
      });
    }

    const { startDate, endDate } = await resolveSchoolYearCollectionRange(db, syid, syStart, syEnd);
    const rows = await fetchDailyCashRows(db, {
      startDate,
      endDate,
      paymentTypeId,
      status,
      syid,
    });
    const processed = buildProcessedPayments(rows);
    const { months, items } = buildYearlyTableData(processed.processedItems);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        months,
        items,
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

export const getFinanceV1ReceivableSummaryTotals = async ({
  schoolDbConfig,
  syid,
  semid,
  programId = null,
  levelId = null,
  sectionId = null,
  granteeId = null,
  modeId = null,
  dateFilter = null,
  startDate = null,
  endDate = null,
}) => {
  if (!schoolDbConfig) {
    throw new Error('School database configuration is required');
  }

  const filters = resolveReceivableFilters({
    syid,
    semid,
    programId,
    levelId,
    sectionId,
    granteeId,
    modeId,
    dateFilter,
    startDate,
    endDate,
  });

  if (!filters.syid) {
    return {
      summary: {
        total_assessment: 0,
        total_discount: 0,
        total_net_assessed: 0,
        total_payment: 0,
        total_receivable: 0,
        total_students: 0,
        students_with_balance: 0,
        average_balance: 0,
        total_overpayment: 0,
        overpaid_count: 0,
      },
      appliedDateRange: filters.dateRange,
    };
  }

  let dbConnection = null;

  try {
    dbConnection = await getSchoolConnection(schoolDbConfig);
    const schoolInfo = await getSchoolInfo(dbConnection);

    const students = await fetchStudents(dbConnection, {
      syid: filters.syid,
      semid: filters.semid,
      programId: filters.programId,
      levelId: filters.levelId,
      sectionId: filters.sectionId,
      granteeId: filters.granteeId,
      modeId: filters.modeId,
      search: null,
    });

    const studentsWithTotals = await getStudentsWithBalancesBulk(
      dbConnection,
      students,
      filters.syid,
      filters.semid,
      schoolInfo,
      filters.dateRange
    );

    const aggregated = buildSummary(studentsWithTotals);
    aggregated.appliedDateRange = filters.dateRange;
    return aggregated;
  } catch (error) {
    console.error('Error computing finance v1 receivables summary:', error);
    throw error;
  } finally {
    if (dbConnection) {
      try {
        await dbConnection.end();
      } catch {
        // Ignore close error
      }
    }
  }
};
