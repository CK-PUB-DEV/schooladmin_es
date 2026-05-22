import mysql from 'mysql2/promise';
import {
  buildCollectionAggregations,
  fetchProcessedCollectionItems,
  normalizeDateKey,
  round2,
} from './financeV2ReportUtils.js';

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

// Get cashier summary statistics
export const getCashierSummary = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      syid,
      semid,
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

    const schoolDb = await getSchoolConnection(schoolDbConfig);
    const processed = await fetchProcessedCollectionItems(schoolDb, {
      syid,
      startDate,
      endDate,
      paymentTypeId,
      terminalId,
      status,
    });

    const totalCollections = processed.transactions.reduce(
      (sum, item) => sum + Number(item.net_amount || 0),
      0
    );
    const cancelledRows =
      status === 'cancelled' ? processed.transactions : processed.transactions.filter((item) => Number(item.cancelled) === 1);
    const cancelledAmount = cancelledRows.reduce(
      (sum, item) => sum + Number(item.net_amount || 0),
      0
    );
    const overpaymentRows = processed.transactions.filter(
      (item) => Number(item.overpayment_amount || 0) > 0
    );
    const overpaymentAmount = overpaymentRows.reduce(
      (sum, item) => sum + Number(item.overpayment_amount || 0),
      0
    );
    const aggregations = buildCollectionAggregations(processed);

    await schoolDb.end();

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          total_transactions: processed.transactions.length,
          total_collections: round2(totalCollections),
          cancelled_amount: round2(cancelledAmount),
          cancelled_count: cancelledRows.length,
          overpayment_amount: round2(overpaymentAmount),
          overpayment_count: overpaymentRows.length,
        },
        byPaymentType: aggregations.byPaymentType,
        byClassification: aggregations.byClassification,
        byTerminal: aggregations.byTerminal,
        dailyCollections: aggregations.byDay
          .slice()
          .sort((a, b) => b.date.localeCompare(a.date))
          .slice(0, 7),
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

// Get transaction list
export const getTransactionList = async (req, res) => {
  try {
    const {
      schoolDbConfig,
      syid,
      semid,
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

    const schoolDb = await getSchoolConnection(schoolDbConfig);
    const { transactions, processedItems } = await fetchProcessedCollectionItems(schoolDb, {
      syid,
      startDate,
      endDate,
      paymentTypeId,
      terminalId,
      status,
    });

    const itemsByTransno = new Map();
    processedItems.forEach((item) => {
      if (!itemsByTransno.has(item.transno)) {
        itemsByTransno.set(item.transno, new Set());
      }
      itemsByTransno.get(item.transno).add(item.itemdesc || item.classification);
    });

    const data = transactions.map((transaction) => ({
      ...transaction,
      trans_day: normalizeDateKey(transaction.trans_day || transaction.transdate),
      totalamount: transaction.net_amount,
      items: Array.from(itemsByTransno.get(transaction.transno) || []).join(', '),
    }));

    await schoolDb.end();

    res.status(200).json({
      status: 'success',
      data,
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

// Get payment types
export const getPaymentTypes = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const schoolDb = await getSchoolConnection(schoolDbConfig);

    const [paymentTypes] = await schoolDb.execute(
      'SELECT * FROM paymenttype WHERE deleted = 0 ORDER BY id'
    );

    await schoolDb.end();

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

// Get terminals
export const getTerminals = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const schoolDb = await getSchoolConnection(schoolDbConfig);

    const [terminals] = await schoolDb.execute(
      'SELECT * FROM chrngterminals ORDER BY id'
    );

    await schoolDb.end();

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
