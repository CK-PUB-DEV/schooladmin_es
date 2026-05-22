import mysql from 'mysql2/promise';
import {
  buildCollectionAggregations,
  buildDailyCashSummary as buildFinanceV2DailyCashSummary,
  fetchProcessedCollectionItems,
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
    const transno = row.transno;
    if (!transactions.has(transno)) {
      transactions.set(transno, {
        transno,
        ornum: row.ornum,
        transdate: row.transdate,
        trans_day: normalizeDateKey(row.trans_day),
        amountpaid: Number(row.amountpaid) || 0,
        change_amount: Number(row.change_amount) || 0,
        payment_type: row.payment_type || 'N/A',
        paymenttype_id: row.paymenttype_id || null,
        items: [],
      });
    }

    const transaction = transactions.get(transno);
    transaction.amountpaid = Math.max(
      transaction.amountpaid,
      Number(row.amountpaid) || 0
    );
    transaction.items.push({
      transno,
      ornum: row.ornum,
      transdate: row.transdate,
      trans_day: normalizeDateKey(row.trans_day),
      studid: row.studid,
      sid: row.sid,
      student_name: row.student_name,
      classid: row.classid,
      classification: row.classification,
      particulars: row.particulars,
      amount: Number(row.amount) || 0,
      payment_type: row.payment_type || 'N/A',
    });
  });

  const processedItems = [];
  let totalOverpayment = 0;
  let overpaymentCount = 0;

  transactions.forEach((transaction) => {
    const itemsTotal = transaction.items.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0
    );
    const overpayment = Math.max(
      0,
      (Number(transaction.amountpaid) || 0) -
        itemsTotal -
        (Number(transaction.change_amount) || 0)
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
        paid_amount: Number(item.amount || 0) + itemOverpayment,
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

const buildSummary = ({ transactions, processedItems, totalOverpayment, overpaymentCount }) => {
  const totalCollections = processedItems.reduce(
    (sum, item) => sum + (Number(item.paid_amount) || 0),
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

const buildAggregations = ({ transactions, processedItems }) => {
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
    dayEntry.total_amount += Number(item.paid_amount) || 0;
    dayEntry.item_count += 1;
    dayEntry.transaction_ids.add(item.transno);
    if (Number(item.overpayment) > 0) {
      dayEntry.overpayment_amount += Number(item.overpayment);
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
    classEntry.total_amount += Number(item.paid_amount) || 0;
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
    typeEntry.total_amount += Number(item.paid_amount) || 0;
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
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount));

  const byPaymentType = Array.from(byPaymentTypeMap.values())
    .map((entry) => ({
      payment_type: entry.payment_type,
      total_amount: Number(entry.total_amount.toFixed(2)),
      transaction_count: entry.transaction_ids.size,
    }))
    .sort((a, b) => Number(b.total_amount) - Number(a.total_amount));

  return { byDay, byClassification, byPaymentType };
};

const fetchPaymentRows = async (db, { startDate, endDate, paymentTypeId }) => {
  const params = [startDate, endDate];
  let query = `
    SELECT
      ct.transno,
      ct.ornum,
      ct.transdate,
      DATE(ct.transdate) as trans_day,
      ct.amountpaid,
      ct.change_amount,
      ct.paymenttype_id,
      pt.description as payment_type,
      ct.studid,
      s.sid,
      TRIM(CONCAT_WS(' ', s.lastname, s.firstname, s.middlename)) as student_name,
      cct.classid,
      ic.description as classification,
      cct.particulars,
      cct.amount
    FROM chrngtrans ct
    JOIN chrngcashtrans cct ON ct.transno = cct.transno
    LEFT JOIN paymenttype pt ON ct.paymenttype_id = pt.id
    LEFT JOIN itemclassification ic ON cct.classid = ic.id
    LEFT JOIN studinfo s ON ct.studid = s.id
    WHERE ct.cancelled = 0
      AND cct.deleted = 0
      AND DATE(ct.transdate) >= ?
      AND DATE(ct.transdate) <= ?
  `;

  if (paymentTypeId) {
    query += ' AND ct.paymenttype_id = ?';
    params.push(paymentTypeId);
  }

  query += ' ORDER BY ct.transdate DESC, ct.transno DESC, cct.id ASC';

  const [rows] = await db.execute(query, params);
  return rows;
};

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

    const processed = await fetchProcessedCollectionItems(db, {
      date: resolvedStart === resolvedEnd ? resolvedStart : null,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      paymentTypeId,
    });
    const summary = buildFinanceV2DailyCashSummary(processed);
    const aggregations = buildCollectionAggregations(processed);

    await db.end();

    res.status(200).json({
      status: 'success',
      data: {
        summary,
        byDay: aggregations.byDay,
        byClassification: aggregations.byClassification,
        byPaymentType: aggregations.byPaymentType,
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

    const processed = await fetchProcessedCollectionItems(db, {
      date: resolvedStart === resolvedEnd ? resolvedStart : null,
      startDate: resolvedStart,
      endDate: resolvedEnd,
      paymentTypeId,
    });

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
