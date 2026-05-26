import mysql from 'mysql2/promise';

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

const toNumber = (value) => Number(value) || 0;

const emptyReceivableSummary = () => ({
  total_assessment: 0,
  total_discount: 0,
  total_payment: 0,
  total_receivable: 0,
  total_balance: 0,
  total_students: 0,
  students_with_balance: 0,
  average_balance: 0,
  total_overpayment: 0,
  overpaid_count: 0,
});

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

const hasDateRange = (dateRange = {}) => Boolean(dateRange.dateFrom || dateRange.dateTo);

const isMissingStudentTransactionsTable = (error) =>
  error?.code === 'ER_NO_SUCH_TABLE' ||
  String(error?.message || '').includes("student_transactions");

// ============================================================================
// FINANCE V1 STUDLEDGER-BASED CALCULATION
// Based on StatementofAccountController.php logic
// ============================================================================

/**
 * Calculate student totals directly from studledger table (finance_v1 approach)
 * This mirrors the PHP StatementofAccountController.php logic where:
 * - balance = SUM(amount) - SUM(payment) from studledger where void=0 and deleted=0
 *
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const calculateStudentTotalsFromLedger = async (db, student, syid, semid, schoolInfo, dateRange = {}) => {
  if (!syid) {
    return {
      total_fees: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };
  }

  try {
    const params = [student.id, syid];
    let query = `
      SELECT
        SUM(CASE WHEN void = 0 THEN amount ELSE 0 END) as total_amount,
        SUM(CASE WHEN void = 0 THEN payment ELSE 0 END) as total_payment
      FROM studledger
      WHERE studid = ? AND syid = ? AND deleted = 0
    `;

    // Apply semester filter based on level (same logic as PHP)
    if (student.levelid === 14 || student.levelid === 15) {
      // SHS: check shssetup flag
      if (schoolInfo && schoolInfo.shssetup === 0 && semid) {
        query += ' AND semid = ?';
        params.push(semid);
      }
    } else if (student.levelid >= 17 && student.levelid <= 25) {
      // College: always filter by semester
      if (semid) {
        query += ' AND semid = ?';
        params.push(semid);
      }
    }
    // For basic education (levelid 1-13), no semester filter needed

    // Apply date range filter (matches PHP: filter by createddatetime)
    const { dateFrom, dateTo } = dateRange;
    if (dateFrom) {
      query += ' AND DATE(createddatetime) >= ?';
      params.push(dateFrom);
    }
    if (dateTo) {
      query += ' AND DATE(createddatetime) <= ?';
      params.push(dateTo);
    }

    const [rows] = await db.execute(query, params);
    const totalAmount = toNumber(rows[0]?.total_amount);
    const totalPayment = toNumber(rows[0]?.total_payment);

    const balance = Math.max(totalAmount - totalPayment, 0);
    const overpayment = Math.max(totalPayment - totalAmount, 0);

    return {
      total_fees: Number(totalAmount.toFixed(2)),
      total_paid: Number(totalPayment.toFixed(2)),
      balance: Number(balance.toFixed(2)),
      overpayment: Number(overpayment.toFixed(2)),
    };
  } catch (error) {
    // Return zeros if query fails
    return {
      total_fees: 0,
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
      'SELECT COUNT(*) as count FROM studledger WHERE studid = ? AND syid = ? AND deleted = 0 LIMIT 1',
      [studid, syid]
    );
    return toNumber(rows[0]?.count) > 0;
  } catch (error) {
    // Table might not exist, return false to use fallback calculation
    return false;
  }
};

const getSchoolInfo = async (db) => {
  const [rows] = await db.execute('SELECT shssetup FROM schoolinfo LIMIT 1');
  return rows[0] || null;
};

const getBalForwardClassId = async (db) => {
  const [rows] = await db.execute('SELECT classid FROM balforwardsetup LIMIT 1');
  return rows[0]?.classid || null;
};

const getAcademicPrograms = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, progname FROM academicprogram ORDER BY id'
  );
  return rows;
};

const getGradeLevels = async (db) => {
  const [rows] = await db.execute(
    'SELECT id, levelname, acadprogid FROM gradelevel WHERE deleted = 0 ORDER BY levelname'
  );
  return rows;
};

const getSchoolYears = async (db, limit = 4) => {
  const [rows] = await db.execute(
    'SELECT id, sydesc, sdate, edate, isactive FROM sy WHERE isactive IN (0, 1) ORDER BY sydesc DESC'
  );
  return rows.slice(0, Math.max(1, limit));
};

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
    let query = `SELECT studid FROM ${table} WHERE deleted = 0`;
    if (syid) {
      query += ' AND syid = ?';
      params.push(syid);
    }
    if (useSem && semid) {
      query += ' AND semid = ?';
      params.push(semid);
    }

    const [rows] = await db.execute(query, params);
    rows.forEach((row) => ids.add(row.studid));
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

const getEnrollmentTable = (levelid) => {
  if (levelid === 14 || levelid === 15) return 'sh_enrolledstud';
  if (levelid >= 17 && levelid <= 25) return 'college_enrolledstud';
  return 'enrolledstud';
};

const useSemesterForLevel = (levelid) => levelid >= 14 && levelid <= 25;

const getFeesIdForStudent = async (db, student, syid, semid) => {
  if (student.feesid) {
    return student.feesid;
  }

  if (!syid) {
    return null;
  }

  const enrollTable = getEnrollmentTable(student.levelid);
  const params = [student.id, syid];
  let query = `SELECT feesid FROM ${enrollTable} WHERE studid = ? AND syid = ? AND deleted = 0`;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  query += ' ORDER BY id DESC LIMIT 1';
  const [rows] = await db.execute(query, params);
  return rows[0]?.feesid || null;
};

const getStudentUnits = async (db, studid, syid, semid, levelid) => {
  if (!(levelid >= 17 && levelid <= 25)) {
    return 0;
  }

  const [rows] = await db.execute(
    `SELECT cp.lecunits, cp.labunits, cp.subjectID
     FROM college_loadsubject cls
     JOIN college_prospectus cp ON cls.subjectID = cp.id
     WHERE cls.studid = ? AND cls.syid = ? AND cls.semid = ? AND cls.deleted = 0`,
    [studid, syid, semid]
  );

  let totalUnits = 0;
  for (const unit of rows) {
    const [assessmentRows] = await db.execute(
      'SELECT id FROM tuition_assessmentunit WHERE subjid = ? AND deleted = 0 LIMIT 1',
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

const getStudentSubjectCount = async (db, studid, syid, semid, levelid) => {
  if (levelid >= 17 && levelid <= 25) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM college_loadsubject
       WHERE studid = ? AND syid = ? AND semid = ? AND deleted = 0`,
      [studid, syid, semid]
    );
    return toNumber(rows[0]?.count);
  }

  if (levelid === 14 || levelid === 15) {
    const [rows] = await db.execute(
      `SELECT COUNT(*) as count
       FROM sh_studsched ss
       JOIN sh_classsched sc ON ss.schedid = sc.id
       WHERE ss.studid = ? AND ss.deleted = 0 AND sc.deleted = 0
         AND sc.syid = ? AND sc.semid = ?`,
      [studid, syid, semid]
    );
    return toNumber(rows[0]?.count);
  }

  return 0;
};

const fetchTuitionFees = async (db, student, syid, semid, schoolInfo) => {
  if (!syid) {
    return [];
  }

  const feesId = await getFeesIdForStudent(db, student, syid, semid);
  const params = [syid];
  let query = `
    SELECT
      td.classificationid as classid,
      td.amount,
      td.istuition,
      td.persubj
    FROM tuitionheader th
    JOIN tuitiondetail td ON th.id = td.headerid
    JOIN itemclassification ic ON td.classificationid = ic.id
    WHERE th.syid = ?
      AND th.deleted = 0
      AND td.deleted = 0
      AND ic.deleted = 0
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

const applyDiscounts = async (db, student, syid, semid, totalsByClass) => {
  if (!syid || Object.keys(totalsByClass).length === 0) {
    return { totals: totalsByClass, discount: 0 };
  }

  const params = [student.id, syid];
  let query = `
    SELECT classid, SUM(discamount) as amount
    FROM studdiscounts
    WHERE studid = ? AND syid = ? AND deleted = 0 AND posted = 1
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  query += ' GROUP BY classid';
  const [rows] = await db.execute(query, params);

  const updated = { ...totalsByClass };
  let totalAppliedDiscount = 0;
  rows.forEach((row) => {
    const classid = row.classid;
    const discount = toNumber(row.amount);
    if (!updated[classid]) return;
    const applied = Math.min(updated[classid], discount);
    updated[classid] = Math.max(updated[classid] - applied, 0);
    totalAppliedDiscount += applied;
  });

  return { totals: updated, discount: totalAppliedDiscount };
};

const fetchBookEntries = async (db, student, syid, semid) => {
  if (!syid) return 0;

  const params = [student.id, syid];
  // Match StudentAccountV2Controller.php - only count APPROVED book entries
  let query = `
    SELECT SUM(amount) as amount
    FROM bookentries
    WHERE studid = ? AND syid = ? AND deleted = 0 AND bestatus = 'APPROVED'
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND semid = ?';
    params.push(semid);
  }

  const [rows] = await db.execute(query, params);
  return toNumber(rows[0]?.amount);
};

const fetchAdjustmentCharges = async (db, student, syid, semid) => {
  if (!syid) return 0;

  // Match StudentAccountV2Controller.php - filter by levelid
  const params = [student.id, syid, student.levelid];
  let query = `
    SELECT SUM(a.amount) as amount
    FROM adjustmentdetails ad
    JOIN adjustments a ON ad.headerid = a.id
    WHERE ad.studid = ? AND a.syid = ? AND a.levelid = ? AND ad.deleted = 0 AND a.deleted = 0
      AND a.isdebit = 1
  `;

  if (useSemesterForLevel(student.levelid) && semid) {
    query += ' AND a.semid = ?';
    params.push(semid);
  }

  const [rows] = await db.execute(query, params);
  return toNumber(rows[0]?.amount);
};

const fetchOldAccountCharges = async (db, student, syid, semid, balClassId) => {
  if (!syid) return 0;

  // Match StudentAccountV2Controller.php - use old_student_accounts table
  // Sum balances from non-forwarded old accounts (isforwarded = 0)
  const params = [student.id];
  const query = `
    SELECT SUM(balance) as amount
    FROM old_student_accounts
    WHERE stud_id = ? AND deleted = 0 AND isforwarded = 0
  `;

  try {
    const [rows] = await db.execute(query, params);
    return toNumber(rows[0]?.amount);
  } catch (error) {
    // Table might not exist in some databases, fall back to 0
    return 0;
  }
};

const fetchStudentPayments = async (db, student, syid, semid, balClassId) => {
  if (!syid) return 0;

  const paymentParams = [student.id, syid];
  let paymentQuery = `
    SELECT SUM(IFNULL(amountpaid, 0) - IFNULL(change_amount, 0)) as amount
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
      WHERE studid = ? AND syid = ? AND classid = ? AND deleted = 0 AND payment > 0
    `;

    if (useSemesterForLevel(student.levelid) && semid) {
      oldQuery += ' AND semid = ?';
      oldParams.push(semid);
    }

    const [oldRows] = await db.execute(oldQuery, oldParams);
    oldPayments = toNumber(oldRows[0]?.amount);
  }

  // Match StudentAccountV2Controller.php - credit adjustments also filter by levelid
  const creditParams = [student.id, syid, student.levelid];
  let creditQuery = `
    SELECT SUM(a.amount) as amount
    FROM adjustmentdetails ad
    JOIN adjustments a ON ad.headerid = a.id
    WHERE ad.studid = ? AND a.syid = ? AND a.levelid = ? AND ad.deleted = 0 AND a.deleted = 0
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
 * @param {object} dateRange - Optional { dateFrom, dateTo } for filtering by createddatetime
 */
const calculateStudentTotals = async (db, student, syid, semid, schoolInfo, balClassId, useStudledger = false, dateRange = {}) => {
  if (!syid) {
    return {
      total_fees: 0,
      total_discount: 0,
      total_assessment: 0,
      total_paid: 0,
      balance: 0,
      overpayment: 0,
    };
  }

  // Finance V1 approach: Use studledger directly if flag is set or if student has ledger entries
  // This mirrors StatementofAccountController.php logic
  if (useStudledger) {
    const hasLedger = await hasStudledgerEntries(db, student.id, syid);
    if (hasLedger) {
      return calculateStudentTotalsFromLedger(db, student, syid, semid, schoolInfo, dateRange);
    }
  }

  // Default approach: Calculate from tuition setup and transactions
  const tuitionRows = await fetchTuitionFees(db, student, syid, semid, schoolInfo);
  const totalsByClass = {};

  let units = 0;
  let subjectCount = 0;
  const needsUnits = tuitionRows.some((row) => Number(row.istuition) === 1);
  const needsSubjects = tuitionRows.some((row) => Number(row.persubj) === 1);

  if (needsUnits) {
    units = await getStudentUnits(db, student.id, syid, semid, student.levelid);
  }
  if (needsSubjects) {
    subjectCount = await getStudentSubjectCount(db, student.id, syid, semid, student.levelid);
  }

  tuitionRows.forEach((row) => {
    let amount = toNumber(row.amount);
    if (Number(row.istuition) === 1 && units > 0) {
      amount = amount * units;
    } else if (Number(row.persubj) === 1 && subjectCount > 0) {
      amount = amount * subjectCount;
    }

    if (amount <= 0) return;
    totalsByClass[row.classid] = (totalsByClass[row.classid] || 0) + amount;
  });

  const discountData = await applyDiscounts(db, student, syid, semid, totalsByClass);
  const discountedTotals = discountData.totals;
  const grossTuitionTotal = Object.values(totalsByClass).reduce(
    (sum, value) => sum + toNumber(value),
    0
  );
  const tuitionTotal = Object.values(discountedTotals).reduce(
    (sum, value) => sum + toNumber(value),
    0
  );

  const adjustmentCharges = await fetchAdjustmentCharges(db, student, syid, semid);
  const bookEntries = await fetchBookEntries(db, student, syid, semid);
  const oldAccounts = await fetchOldAccountCharges(db, student, syid, semid, balClassId);

  const totalFees = tuitionTotal + adjustmentCharges + bookEntries + oldAccounts;
  const totalPaid = await fetchStudentPayments(db, student, syid, semid, balClassId);

  const balance = Math.max(totalFees - totalPaid, 0);
  const overpayment = Math.max(totalPaid - totalFees, 0);

  return {
    total_assessment: Number((grossTuitionTotal + adjustmentCharges + bookEntries + oldAccounts).toFixed(2)),
    total_discount: Number(discountData.discount.toFixed(2)),
    total_fees: Number(totalFees.toFixed(2)),
    total_paid: Number(totalPaid.toFixed(2)),
    balance: Number(balance.toFixed(2)),
    overpayment: Number(overpayment.toFixed(2)),
  };
};

const buildSummary = (studentsWithTotals) => {
  const summary = {
    total_assessment: 0,
    total_discount: 0,
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
  const tiers = [
    { label: '0 - 1k', min: 0, max: 1000, count: 0, total_balance: 0 },
    { label: '1k - 5k', min: 1000, max: 5000, count: 0, total_balance: 0 },
    { label: '5k - 20k', min: 5000, max: 20000, count: 0, total_balance: 0 },
    { label: '20k+', min: 20000, max: Infinity, count: 0, total_balance: 0 },
  ];

  studentsWithTotals.forEach((student) => {
    const balance = toNumber(student.balance);
    const overpayment = toNumber(student.overpayment);
    summary.total_assessment += toNumber(student.total_assessment || student.total_fees);
    summary.total_discount += toNumber(student.total_discount);
    summary.total_payment += toNumber(student.total_paid);

    if (balance > 0) {
      summary.total_receivable += balance;
      summary.students_with_balance += 1;

      const tier = tiers.find((item) => balance >= item.min && balance < item.max);
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
      ? Number((summary.total_receivable / summary.students_with_balance).toFixed(2))
      : 0;
  summary.total_receivable = Number(summary.total_receivable.toFixed(2));
  summary.total_overpayment = Number(summary.total_overpayment.toFixed(2));
  summary.total_assessment = Number(summary.total_assessment.toFixed(2));
  summary.total_discount = Number(summary.total_discount.toFixed(2));
  summary.total_payment = Number(summary.total_payment.toFixed(2));

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

  const balanceTiers = tiers.map((tier) => ({
    ...tier,
    total_balance: Number(tier.total_balance.toFixed(2)),
  }));

  return { summary, byProgram: programData, byGradeLevel: gradeLevelData, balanceTiers };
};

const fetchStudents = async (db, { syid, semid, programId, levelId, search }) => {
  const enrolledIds = await getEnrolledStudentIds(
    db,
    syid,
    semid,
    programId ? Number(programId) : null
  );

  let query = `
    SELECT
      si.id,
      si.sid,
      si.firstname,
      si.middlename,
      si.lastname,
      si.levelid,
      si.courseid,
      si.strandid,
      si.feesid,
      gl.levelname as level_name,
      gl.acadprogid as acadprog_id,
      ap.progname as program_name
    FROM studinfo si
    LEFT JOIN gradelevel gl ON gl.id = si.levelid
    LEFT JOIN academicprogram ap ON ap.id = gl.acadprogid
    WHERE si.deleted = 0
  `;

  const params = [];

  if (programId) {
    query += ' AND gl.acadprogid = ?';
    params.push(programId);
  }

  if (levelId) {
    query += ' AND si.levelid = ?';
    params.push(levelId);
  }

  if (enrolledIds && enrolledIds.length > 0) {
    const placeholders = enrolledIds.map(() => '?').join(',');
    query += ` AND si.id IN (${placeholders})`;
    params.push(...enrolledIds);
  } else if (enrolledIds && enrolledIds.length === 0) {
    return [];
  }

  if (search) {
    query += ` AND (
      si.sid LIKE ?
      OR CONCAT_WS(' ', si.lastname, si.firstname, si.middlename) LIKE ?
    )`;
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  query += ' ORDER BY si.lastname, si.firstname';

  const [students] = await db.execute(query, params);
  return students;
};

const shouldUseStudentTransactions = ({ dateRange, useStudledger }) =>
  !useStudledger && !hasDateRange(dateRange);

const buildStudentTransactionQueryParts = ({ syid, semid, programId, levelId, search }) => {
  const params = [];
  const where = ['si.deleted = 0'];

  if (syid) {
    where.push('st.syid = ?');
    params.push(syid);
  }

  if (semid) {
    where.push('st.semid = ?');
    params.push(semid);
  }

  if (programId) {
    where.push('gl.acadprogid = ?');
    params.push(programId);
  }

  if (levelId) {
    where.push('si.levelid = ?');
    params.push(levelId);
  }

  if (search) {
    where.push(`(
      si.sid LIKE ?
      OR CONCAT_WS(' ', si.lastname, si.firstname, si.middlename) LIKE ?
      OR CONCAT_WS(' ', si.firstname, si.middlename, si.lastname) LIKE ?
    )`);
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  const from = `
    FROM student_transactions st
    JOIN studinfo si ON si.id = st.studid
    LEFT JOIN gradelevel gl ON gl.id = si.levelid
    LEFT JOIN academicprogram ap ON ap.id = gl.acadprogid
  `;

  return {
    from,
    where: `WHERE ${where.join(' AND ')}`,
    params,
  };
};

const mapStudentTransactionRow = (row) => ({
  id: row.studid,
  transaction_id: row.transaction_id,
  sid: row.sid,
  firstname: row.firstname,
  middlename: row.middlename,
  lastname: row.lastname,
  levelid: row.levelid,
  courseid: row.courseid,
  strandid: row.strandid,
  feesid: row.feesid,
  level_name: row.level_name,
  acadprog_id: row.acadprog_id,
  program_name: row.program_name,
  full_name:
    row.full_name ||
    [row.lastname, row.firstname, row.middlename].filter(Boolean).join(' ').trim() ||
    row.sid ||
    'Unknown',
  total_assessment: toNumber(row.total_payables),
  total_discount: 0,
  total_fees: toNumber(row.total_payables),
  total_paid: toNumber(row.total_payment),
  balance: toNumber(row.total_balance),
  overpayment: toNumber(row.total_overpayment),
  last_calculated_at: row.last_calculated_at,
});

const fetchStudentTransactionRows = async (
  db,
  { syid, semid, programId, levelId, search, page = 1, perPage = 200 }
) => {
  const queryParts = buildStudentTransactionQueryParts({
    syid,
    semid,
    programId,
    levelId,
    search,
  });

  const [countRows] = await db.execute(
    `
      SELECT COUNT(*) as total
      ${queryParts.from}
      ${queryParts.where}
    `,
    queryParts.params
  );
  const total = toNumber(countRows[0]?.total);

  const safePerPage = Math.max(0, Number(perPage) || 0);
  const safePage = Math.max(1, Number(page) || 1);
  const params = [...queryParts.params];
  let limitClause = '';

  if (safePerPage > 0) {
    limitClause = 'LIMIT ? OFFSET ?';
    params.push(safePerPage, (safePage - 1) * safePerPage);
  }

  const [rows] = await db.execute(
    `
      SELECT
        st.id as transaction_id,
        st.studid,
        st.total_payables,
        st.total_payment,
        st.total_balance,
        st.total_overpayment,
        st.last_calculated_at,
        si.sid,
        si.firstname,
        si.middlename,
        si.lastname,
        CONCAT_WS(' ', si.lastname, si.firstname, si.middlename) as full_name,
        si.levelid,
        si.courseid,
        si.strandid,
        si.feesid,
        gl.levelname as level_name,
        gl.acadprogid as acadprog_id,
        ap.progname as program_name
      ${queryParts.from}
      ${queryParts.where}
      ORDER BY st.total_balance DESC, si.lastname, si.firstname
      ${limitClause}
    `,
    params
  );

  return {
    rows: rows.map(mapStudentTransactionRow),
    total,
    page: safePage,
    perPage: safePerPage,
  };
};

const fetchAllStudentTransactionRows = async (db, filters) => {
  const queryParts = buildStudentTransactionQueryParts(filters);
  const [rows] = await db.execute(
    `
      SELECT
        st.id as transaction_id,
        st.studid,
        st.total_payables,
        st.total_payment,
        st.total_balance,
        st.total_overpayment,
        st.last_calculated_at,
        si.sid,
        si.firstname,
        si.middlename,
        si.lastname,
        CONCAT_WS(' ', si.lastname, si.firstname, si.middlename) as full_name,
        si.levelid,
        si.courseid,
        si.strandid,
        si.feesid,
        gl.levelname as level_name,
        gl.acadprogid as acadprog_id,
        ap.progname as program_name
      ${queryParts.from}
      ${queryParts.where}
      ORDER BY si.lastname, si.firstname
    `,
    queryParts.params
  );

  return rows.map(mapStudentTransactionRow);
};

const fetchStudentTransactionSummaryTotals = async (db, filters) => {
  const queryParts = buildStudentTransactionQueryParts(filters);
  const [rows] = await db.execute(
    `
      SELECT
        COALESCE(SUM(st.total_payables), 0) as total_assessment,
        COALESCE(SUM(st.total_payment), 0) as total_payment,
        COALESCE(SUM(st.total_payables), 0) as total_receivable,
        COALESCE(SUM(CASE WHEN st.total_balance > 0 THEN st.total_balance ELSE 0 END), 0) as total_balance,
        COALESCE(SUM(st.total_overpayment), 0) as total_overpayment,
        COUNT(*) as total_students,
        COALESCE(SUM(CASE WHEN st.total_balance > 0 THEN 1 ELSE 0 END), 0) as students_with_balance,
        COALESCE(SUM(CASE WHEN st.total_overpayment > 0 THEN 1 ELSE 0 END), 0) as overpaid_count
      ${queryParts.from}
      ${queryParts.where}
    `,
    queryParts.params
  );

  const row = rows[0] || {};
  const totalReceivable = toNumber(row.total_receivable);
  const totalBalance = toNumber(row.total_balance);
  const studentsWithBalance = toNumber(row.students_with_balance);

  return {
    summary: {
      total_assessment: Number(toNumber(row.total_assessment).toFixed(2)),
      total_discount: 0,
      total_payment: Number(toNumber(row.total_payment).toFixed(2)),
      total_receivable: Number(totalReceivable.toFixed(2)),
      total_balance: Number(totalBalance.toFixed(2)),
      total_students: toNumber(row.total_students),
      students_with_balance: studentsWithBalance,
      average_balance:
        studentsWithBalance > 0
          ? Number((totalBalance / studentsWithBalance).toFixed(2))
          : 0,
      total_overpayment: Number(toNumber(row.total_overpayment).toFixed(2)),
      overpaid_count: toNumber(row.overpaid_count),
    },
  };
};

const buildSyComparisonFromStudentTransactions = async (db, { programId, levelId, semid }) => {
  const schoolYears = await getSchoolYears(db, 4);
  const comparison = [];

  for (const sy of schoolYears) {
    const queryParts = buildStudentTransactionQueryParts({
      syid: sy.id,
      semid,
      programId,
      levelId,
      search: null,
    });

    const [rows] = await db.execute(
      `
        SELECT
          COALESCE(SUM(CASE WHEN st.total_balance > 0 THEN st.total_balance ELSE 0 END), 0) as total_receivable,
          COALESCE(SUM(CASE WHEN st.total_balance > 0 THEN 1 ELSE 0 END), 0) as students_with_balance
        ${queryParts.from}
        ${queryParts.where}
      `,
      queryParts.params
    );

    comparison.push({
      syid: sy.id,
      sydesc: sy.sydesc,
      total_receivable: Number(toNumber(rows[0]?.total_receivable).toFixed(2)),
      students_with_balance: toNumber(rows[0]?.students_with_balance),
    });
  }

  return comparison;
};

const buildSyComparison = async (db, options) => {
  const { programId, levelId, semid, schoolInfo, balClassId, useStudledger = false, dateRange = {} } = options;
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
        balClassId,
        useStudledger,
        dateRange
      );

      if (Number(totals.total_fees) <= 0) {
        continue;
      }

      if (totals.balance > 0) {
        totalReceivable += totals.balance;
        studentsWithBalance += 1;
      }
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
    const [programs, gradeLevels] = await Promise.all([
      getAcademicPrograms(db),
      getGradeLevels(db),
    ]);
    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        programs,
        gradeLevels,
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
 * Get Account Receivables detailed list
 *
 * Date filter options:
 * - dateFilter: '30days', '60days', '90days', '1year', 'custom'
 * - startDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 * - endDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 */
export const getAccountReceivableList = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      syid,
      semid,
      programId,
      levelId,
      search,
      dateFilter,
      startDate,
      endDate,
      page = 1,
      perPage = 200,
      useStudledger = false, // Finance V1 flag to use studledger-based calculation
    } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    // Process date range filter
    const dateRange = getDateRangeFromFilter(dateFilter, startDate, endDate);

    const db = await getSchoolConnection(schoolDbConfig);

    if (shouldUseStudentTransactions({ dateRange, useStudledger })) {
      try {
        const precomputed = await fetchStudentTransactionRows(db, {
          syid,
          semid,
          programId: programId ? Number(programId) : null,
          levelId: levelId ? Number(levelId) : null,
          search: search || null,
          page,
          perPage,
        });

        await db.end();

        return res.status(200).json({
          status: 'success',
          data: precomputed.rows,
          meta: {
            total: precomputed.total,
            page: precomputed.page,
            per_page: precomputed.perPage,
            pages:
              precomputed.perPage > 0
                ? Math.ceil(precomputed.total / Math.max(1, precomputed.perPage))
                : 1,
            appliedDateRange: dateRange,
            source: 'student_transactions',
          },
        });
      } catch (error) {
        if (!isMissingStudentTransactionsTable(error)) {
          console.warn('Falling back to calculated receivables list:', error.message);
        }
      }
    }

    const schoolInfo = await getSchoolInfo(db);
    const balClassId = await getBalForwardClassId(db);

    const students = await fetchStudents(db, {
      syid,
      semid,
      programId: programId ? Number(programId) : null,
      levelId: levelId ? Number(levelId) : null,
      search: search || null,
    });

    const startIndex = (Number(page) - 1) * Number(perPage);
    const pagedStudents = students.slice(startIndex, startIndex + Number(perPage));

    const studentsWithTotals = [];
    for (const student of pagedStudents) {
      const fullName = [student.lastname, student.firstname, student.middlename]
        .filter(Boolean)
        .join(' ')
        .trim();
      const totals = await calculateStudentTotals(
        db,
        student,
        syid,
        semid,
        schoolInfo,
        balClassId,
        useStudledger,
        dateRange
      );

      if (Number(totals.total_fees) <= 0) {
        continue;
      }

      studentsWithTotals.push({
        ...student,
        full_name: fullName || student.sid || 'Unknown',
        ...totals,
      });
    }

    await db.end();

    res.status(200).json({
      status: 'success',
      data: studentsWithTotals,
      meta: {
        total: studentsWithTotals.length,
        page: Number(page),
        per_page: Number(perPage),
        pages: Math.ceil(studentsWithTotals.length / Math.max(1, Number(perPage))),
        appliedDateRange: dateRange,
      },
    });
  } catch (error) {
    console.error('Error fetching account receivables list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch account receivables list',
      error: error.message,
    });
  }
};

/**
 * Get Account Receivables summary statistics
 *
 * Date filter options:
 * - dateFilter: '30days', '60days', '90days', '1year', 'custom'
 * - startDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 * - endDate: YYYY-MM-DD (used when dateFilter is 'custom' or not specified)
 */
export const getAccountReceivableSummary = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      syid,
      semid,
      programId,
      levelId,
      search,
      dateFilter,
      startDate,
      endDate,
      useStudledger = false, // Finance V1 flag to use studledger-based calculation
    } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    // Process date range filter
    const dateRange = getDateRangeFromFilter(dateFilter, startDate, endDate);

    const db = await getSchoolConnection(schoolDbConfig);

    if (shouldUseStudentTransactions({ dateRange, useStudledger })) {
      try {
        const summaryData = await fetchStudentTransactionSummaryTotals(db, {
          syid,
          semid,
          programId: programId ? Number(programId) : null,
          levelId: levelId ? Number(levelId) : null,
          search: search || null,
        });
        summaryData.byProgram = [];
        summaryData.byGradeLevel = [];
        summaryData.balanceTiers = [];
        summaryData.bySchoolYear = [];
        summaryData.appliedDateRange = dateRange;
        summaryData.source = 'student_transactions';

        await db.end();

        return res.status(200).json({
          status: 'success',
          data: summaryData,
        });
      } catch (error) {
        if (!isMissingStudentTransactionsTable(error)) {
          console.warn('Falling back to calculated receivables summary:', error.message);
        }
      }
    }

    const schoolInfo = await getSchoolInfo(db);
    const balClassId = await getBalForwardClassId(db);

    const students = await fetchStudents(db, {
      syid,
      semid,
      programId: programId ? Number(programId) : null,
      levelId: levelId ? Number(levelId) : null,
      search: search || null,
    });

    const bySchoolYear = await buildSyComparison(db, {
      programId: programId ? Number(programId) : null,
      levelId: levelId ? Number(levelId) : null,
      semid,
      schoolInfo,
      balClassId,
      useStudledger,
      dateRange,
    });

    if (!students.length) {
      await db.end();
      return res.status(200).json({
        status: 'success',
        data: {
          summary: {
            ...emptyReceivableSummary(),
          },
          byProgram: [],
          byGradeLevel: [],
          balanceTiers: [],
          bySchoolYear,
          appliedDateRange: dateRange,
        },
      });
    }
    const studentsWithTotals = [];

    for (const student of students) {
      const totals = await calculateStudentTotals(
        db,
        student,
        syid,
        semid,
        schoolInfo,
        balClassId,
        useStudledger,
        dateRange
      );
      studentsWithTotals.push({
        ...student,
        ...totals,
      });
    }

    const summaryData = buildSummary(studentsWithTotals);
    summaryData.bySchoolYear = bySchoolYear;
    summaryData.appliedDateRange = dateRange;
    await db.end();

    res.status(200).json({
      status: 'success',
      data: summaryData,
    });
  } catch (error) {
    console.error('Error fetching account receivables summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch account receivables summary',
      error: error.message,
    });
  }
};

export const getAccountReceivableSummaryTotals = async ({
  schoolDbConfig,
  syid,
  semid,
  programId = null,
  levelId = null,
  search = null,
  dateFilter = null,
  startDate = null,
  endDate = null,
  useStudledger = false,
}) => {
  if (!schoolDbConfig) {
    throw new Error('School database configuration is required');
  }

  const dateRange = getDateRangeFromFilter(dateFilter, startDate, endDate);

  if (!syid) {
    return {
      summary: emptyReceivableSummary(),
      appliedDateRange: dateRange,
    };
  }

  let dbConnection = null;

  try {
    dbConnection = await getSchoolConnection(schoolDbConfig);

    if (shouldUseStudentTransactions({ dateRange, useStudledger })) {
      try {
        const summaryData = await fetchStudentTransactionSummaryTotals(dbConnection, {
          syid,
          semid,
          programId: programId ? Number(programId) : null,
          levelId: levelId ? Number(levelId) : null,
          search: search || null,
        });
        summaryData.appliedDateRange = dateRange;
        summaryData.source = 'student_transactions';
        return summaryData;
      } catch (error) {
        if (!isMissingStudentTransactionsTable(error)) {
          console.warn('Falling back to calculated receivables totals:', error.message);
        }
      }
    }

    const schoolInfo = await getSchoolInfo(dbConnection);
    const balClassId = await getBalForwardClassId(dbConnection);

    const students = await fetchStudents(dbConnection, {
      syid,
      semid,
      programId: programId ? Number(programId) : null,
      levelId: levelId ? Number(levelId) : null,
      search: search || null,
    });

    if (!students.length) {
      return {
        summary: emptyReceivableSummary(),
        appliedDateRange: dateRange,
      };
    }

    const studentsWithTotals = [];

    for (const student of students) {
      const totals = await calculateStudentTotals(
        dbConnection,
        student,
        syid,
        semid,
        schoolInfo,
        balClassId,
        useStudledger,
        dateRange
      );
      studentsWithTotals.push({
        ...student,
        ...totals,
      });
    }

    const summaryData = buildSummary(studentsWithTotals);
    summaryData.appliedDateRange = dateRange;
    return summaryData;
  } catch (error) {
    console.error('Error computing account receivables summary:', error);
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
