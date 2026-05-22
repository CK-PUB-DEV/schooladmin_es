const toNumber = (value) => Number(value) || 0;

export const round2 = (value) => Number(toNumber(value).toFixed(2));

export const pad2 = (value) => String(value).padStart(2, '0');

export const formatDateKey = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const parseDateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

export const normalizeDateKey = (value) => {
  if (!value) return '';
  if (value instanceof Date) return formatDateKey(value);
  return String(value).slice(0, 10);
};

export const formatMonthLabel = (key) => {
  const [year, month] = String(key || '').split('-').map(Number);
  if (!year || !month) return key;
  return new Date(year, month - 1, 1).toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
  });
};

export const buildMonthRange = (startDate, endDate, fixedCount = null) => {
  const months = [];
  if (!startDate || !endDate) return months;

  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

  while (current <= last) {
    const key = `${current.getFullYear()}-${pad2(current.getMonth() + 1)}`;
    months.push({ key, label: formatMonthLabel(key) });
    current.setMonth(current.getMonth() + 1);
    if (fixedCount && months.length >= fixedCount) break;
  }

  return months;
};

export const getDiscountTotal = (discounts) => {
  if (!discounts) return 0;
  try {
    const parsed = typeof discounts === 'string' ? JSON.parse(discounts) : discounts;
    if (!Array.isArray(parsed)) return 0;
    return parsed.reduce((sum, item) => sum + toNumber(item?.amount), 0);
  } catch {
    return 0;
  }
};

export const resolveItemDescription = (particulars, classid, classification) => {
  const value = particulars || classification || 'Unclassified Payment';
  if (/^(Laboratory Fee|RLE FEE)/i.test(value)) {
    return value.replace(/\s-\s[A-Z][A-Z -]*$/g, '').trim();
  }
  if (classid !== null && classid !== undefined && classification) {
    return classification;
  }
  return value;
};

const buildTransactionWhere = ({
  syid,
  startDate,
  endDate,
  paymentTypeId,
  terminalId,
  status,
  orNumberStart,
  orNumberEnd,
  date,
}) => {
  const clauses = [];
  const params = [];

  const resolvedStatus = status && status !== 'all' ? status : null;
  if (resolvedStatus === 'posted') {
    clauses.push('ct.cancelled = 0', 'ct.posted = 1');
  } else if (resolvedStatus === 'cancelled') {
    clauses.push('ct.cancelled = 1');
  } else if (resolvedStatus === 'pending') {
    clauses.push('ct.cancelled = 0', '(ct.posted = 0 OR ct.posted IS NULL)');
  } else {
    clauses.push('ct.cancelled = 0');
  }

  if (syid) {
    clauses.push('ct.syid = ?');
    params.push(syid);
  }

  if (date) {
    clauses.push('DATE(ct.transdate) = ?');
    params.push(date);
  } else {
    if (startDate) {
      clauses.push('DATE(ct.transdate) >= ?');
      params.push(startDate);
    }
    if (endDate) {
      clauses.push('DATE(ct.transdate) <= ?');
      params.push(endDate);
    }
  }

  if (paymentTypeId) {
    clauses.push('ct.paymenttype_id = ?');
    params.push(paymentTypeId);
  }

  if (terminalId) {
    clauses.push('ct.terminalno = ?');
    params.push(terminalId);
  }

  if (orNumberStart && orNumberEnd) {
    clauses.push('ct.ornum BETWEEN ? AND ?');
    params.push(orNumberStart, orNumberEnd);
  }

  return {
    where: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
};

export const fetchCollectionTransactions = async (db, filters = {}) => {
  const { where, params } = buildTransactionWhere(filters);
  const [rows] = await db.execute(
    `
      SELECT
        ct.id,
        ct.transno,
        ct.ornum,
        ct.transdate,
        DATE(ct.transdate) as trans_day,
        ct.studid,
        si.sid,
        CASE
          WHEN ct.studid IS NULL THEN ct.studname
          ELSE TRIM(CONCAT_WS(' ', si.lastname, si.firstname, si.middlename))
        END as full_name,
        ct.studname,
        gl.levelname as grade_level,
        gl.acadprogid,
        COALESCE(cc.courseDesc, ss.strandname) as course_or_strand,
        COALESCE(cc.courseabrv, ss.strandcode) as course_or_strand_abrv,
        COALESCE(cs.sectionDesc, sec.sectionname) as section_name,
        ct.totalamount,
        ct.amountpaid,
        ct.amounttendered,
        ct.change_amount,
        ct.discounts,
        ct.paymenttype_id,
        COALESCE(NULLIF(pt.description, ''), ct.paytype, 'ONLINE') as payment_type,
        ct.terminalno,
        term.description as terminal,
        COALESCE(cashier.name, op_proc.name, op_appr.name, term.owner) as cashier,
        ct.transby,
        TRIM(CONCAT_WS(' ', tr.lastname, tr.firstname, tr.middlename)) as transacted_by,
        ct.cancelled,
        ct.cancelledremarks,
        ct.posted
      FROM chrngtrans ct
      LEFT JOIN studinfo si ON si.id = ct.studid
      LEFT JOIN gradelevel gl ON gl.id = si.levelid
      LEFT JOIN college_courses cc ON cc.id = si.courseid
      LEFT JOIN sh_strand ss ON ss.id = si.strandid
      LEFT JOIN sections sec ON sec.id = si.sectionid AND gl.acadprogid <> 6
      LEFT JOIN college_sections cs ON cs.id = si.sectionid AND gl.acadprogid = 6
      LEFT JOIN chrngterminals term ON term.id = ct.terminalno
      LEFT JOIN users cashier ON cashier.id = term.owner
      LEFT JOIN teacher tr ON tr.userid = ct.transby
      LEFT JOIN paymenttype pt ON pt.id = ct.paymenttype_id
      LEFT JOIN onlinepayments op ON op.or_number = ct.ornum
      LEFT JOIN users op_proc ON op_proc.id = op.processed_by
      LEFT JOIN users op_appr ON op_appr.id = op.approved_by
      ${where}
      ORDER BY ct.transdate DESC, ct.id DESC
    `,
    params
  );

  return rows.map((row) => {
    const discountTotal = getDiscountTotal(row.discounts);
    const grossPaid = toNumber(row.amountpaid) - toNumber(row.change_amount);
    const netAmount = Math.max(0, grossPaid - discountTotal);
    const netItems = Math.max(0, toNumber(row.totalamount) - discountTotal);
    const overpayment = Math.max(0, netAmount - netItems);

    return {
      ...row,
      totalamount: round2(toNumber(row.totalamount)),
      amountpaid: round2(toNumber(row.amountpaid)),
      amounttendered: round2(toNumber(row.amounttendered)),
      change_amount: round2(toNumber(row.change_amount)),
      discount_amount: round2(discountTotal),
      net_amount: round2(netAmount),
      overpayment_amount: round2(overpayment),
    };
  });
};

const fetchCashTransItems = async (db, transnos) => {
  if (!transnos.length) return new Map();

  const itemMap = new Map();
  const chunkSize = 500;

  for (let i = 0; i < transnos.length; i += chunkSize) {
    const chunk = transnos.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '?').join(',');
    const [rows] = await db.execute(
      `
        SELECT
          cct.id,
          cct.transno,
          cct.studid,
          cct.classid,
          cct.particulars,
          cct.amount,
          ic.description as classification
        FROM chrngcashtrans cct
        LEFT JOIN itemclassification ic ON ic.id = cct.classid
        WHERE cct.transno IN (${placeholders})
          AND (cct.deleted = 0 OR cct.deleted IS NULL)
        ORDER BY cct.transno, cct.id
      `,
      chunk
    );

    rows.forEach((row) => {
      if (!itemMap.has(row.transno)) {
        itemMap.set(row.transno, []);
      }
      itemMap.get(row.transno).push(row);
    });
  }

  return itemMap;
};

const applyDiscountToItems = (items, discountTotal) => {
  const adjusted = items.map((item) => ({
    ...item,
    amount: round2(item.amount),
  }));

  let remaining = round2(discountTotal);
  for (let index = adjusted.length - 1; index >= 0 && remaining > 0; index -= 1) {
    const current = toNumber(adjusted[index].amount);
    if (current <= remaining) {
      remaining = round2(remaining - current);
      adjusted[index].amount = 0;
    } else {
      adjusted[index].amount = round2(current - remaining);
      remaining = 0;
    }
  }

  return adjusted;
};

export const fetchProcessedCollectionItems = async (db, filters = {}) => {
  const transactions = await fetchCollectionTransactions(db, filters);
  const transnos = transactions.map((item) => item.transno).filter(Boolean);
  const itemMap = await fetchCashTransItems(db, transnos);
  const processedItems = [];

  transactions.forEach((transaction) => {
    const rawItems = itemMap.get(transaction.transno) || [];
    const adjustedItems = applyDiscountToItems(rawItems, transaction.discount_amount);
    const itemTotal = adjustedItems.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const overpayment = Math.max(0, toNumber(transaction.net_amount) - itemTotal);
    let first = true;

    if (adjustedItems.length === 0) {
      processedItems.push({
        transno: transaction.transno,
        ornum: transaction.ornum,
        transdate: transaction.transdate,
        trans_day: normalizeDateKey(transaction.trans_day || transaction.transdate),
        studid: transaction.studid,
        sid: transaction.sid,
        student_name: transaction.full_name || transaction.studname,
        classid: 'payment',
        classification: 'Unclassified Payment',
        particulars: 'Unclassified Payment',
        itemdesc: 'Unclassified Payment',
        amount: round2(transaction.net_amount),
        paid_amount: round2(transaction.net_amount),
        overpayment: 0,
        payment_type: transaction.payment_type,
        paymenttype_id: transaction.paymenttype_id,
      });
      return;
    }

    adjustedItems.forEach((item) => {
      const itemOverpayment = first ? overpayment : 0;
      const classification = item.classification || item.particulars || 'Uncategorized';
      const itemdesc = resolveItemDescription(item.particulars, item.classid, item.classification);
      processedItems.push({
        transno: transaction.transno,
        ornum: transaction.ornum,
        transdate: transaction.transdate,
        trans_day: normalizeDateKey(transaction.trans_day || transaction.transdate),
        studid: transaction.studid || item.studid,
        sid: transaction.sid,
        student_name: transaction.full_name || transaction.studname,
        classid: item.classid,
        classification,
        particulars: item.particulars,
        itemdesc,
        amount: round2(item.amount),
        paid_amount: round2(toNumber(item.amount) + itemOverpayment),
        overpayment: round2(itemOverpayment),
        payment_type: transaction.payment_type,
        paymenttype_id: transaction.paymenttype_id,
      });
      first = false;
    });
  });

  return { transactions, processedItems };
};

export const buildDailyCashSummary = ({ transactions, processedItems }) => {
  const totalCollections = processedItems.reduce(
    (sum, item) => sum + toNumber(item.paid_amount),
    0
  );
  const totalOverpayment = processedItems.reduce(
    (sum, item) => sum + toNumber(item.overpayment),
    0
  );
  const overpaymentCount = transactions.filter((item) => toNumber(item.overpayment_amount) > 0).length;

  return {
    total_collections: round2(totalCollections),
    total_transactions: transactions.length,
    total_items: processedItems.length,
    total_overpayment: round2(totalOverpayment),
    overpayment_count: overpaymentCount,
    average_per_transaction:
      transactions.length > 0 ? round2(totalCollections / transactions.length) : 0,
    average_per_item:
      processedItems.length > 0 ? round2(totalCollections / processedItems.length) : 0,
  };
};

export const buildCollectionAggregations = ({ transactions, processedItems }) => {
  const byDayMap = new Map();
  const byClassMap = new Map();
  const byPaymentTypeMap = new Map();
  const byTerminalMap = new Map();

  transactions.forEach((transaction) => {
    const dayKey = normalizeDateKey(transaction.trans_day || transaction.transdate);
    if (!byDayMap.has(dayKey)) {
      byDayMap.set(dayKey, {
        date: dayKey,
        total_amount: 0,
        item_count: 0,
        transaction_count: 0,
        overpayment_amount: 0,
      });
    }
    const day = byDayMap.get(dayKey);
    day.total_amount += toNumber(transaction.net_amount);
    day.transaction_count += 1;
    day.overpayment_amount += toNumber(transaction.overpayment_amount);

    const paymentType = transaction.payment_type || 'N/A';
    if (!byPaymentTypeMap.has(paymentType)) {
      byPaymentTypeMap.set(paymentType, {
        payment_type: paymentType,
        total_amount: 0,
        transaction_count: 0,
      });
    }
    const type = byPaymentTypeMap.get(paymentType);
    type.total_amount += toNumber(transaction.net_amount);
    type.transaction_count += 1;

    const terminalKey = transaction.terminalno || transaction.terminal || 'unknown';
    if (!byTerminalMap.has(terminalKey)) {
      byTerminalMap.set(terminalKey, {
        terminal: transaction.terminal || 'Unknown',
        cashier: transaction.cashier || 'N/A',
        total_amount: 0,
        transaction_count: 0,
      });
    }
    const terminal = byTerminalMap.get(terminalKey);
    terminal.total_amount += toNumber(transaction.net_amount);
    terminal.transaction_count += 1;
  });

  processedItems.forEach((item) => {
    const dayKey = normalizeDateKey(item.trans_day || item.transdate);
    if (byDayMap.has(dayKey)) {
      byDayMap.get(dayKey).item_count += 1;
    }

    const classKey = item.classid ?? item.classification ?? 'uncategorized';
    if (!byClassMap.has(classKey)) {
      byClassMap.set(classKey, {
        classid: item.classid,
        classification: item.classification || 'Uncategorized',
        total_amount: 0,
        item_count: 0,
      });
    }
    const classification = byClassMap.get(classKey);
    classification.total_amount += toNumber(item.amount);
    classification.item_count += 1;
  });

  const sortAmountDesc = (a, b) => toNumber(b.total_amount) - toNumber(a.total_amount);
  const roundEntries = (entries) =>
    entries.map((entry) => ({
      ...entry,
      total_amount: round2(entry.total_amount),
      overpayment_amount:
        entry.overpayment_amount === undefined ? undefined : round2(entry.overpayment_amount),
    }));

  return {
    byDay: roundEntries(Array.from(byDayMap.values())).sort((a, b) => a.date.localeCompare(b.date)),
    byClassification: roundEntries(Array.from(byClassMap.values())).sort(sortAmountDesc),
    byPaymentType: roundEntries(Array.from(byPaymentTypeMap.values())).sort(sortAmountDesc),
    byTerminal: roundEntries(Array.from(byTerminalMap.values())).sort(sortAmountDesc),
  };
};

export const buildCollectionSummaryData = ({ transactions, processedItems }) => {
  const byItemMap = new Map();
  const byMonthMap = new Map();
  let totalCollections = 0;

  transactions.forEach((transaction) => {
    totalCollections += toNumber(transaction.net_amount);
    const monthKey = normalizeDateKey(transaction.transdate || transaction.trans_day).slice(0, 7);
    if (!monthKey) return;
    if (!byMonthMap.has(monthKey)) {
      byMonthMap.set(monthKey, {
        month_key: monthKey,
        total_amount: 0,
        transaction_count: 0,
      });
    }
    const month = byMonthMap.get(monthKey);
    month.total_amount += toNumber(transaction.net_amount);
    month.transaction_count += 1;
  });

  processedItems.forEach((item) => {
    const label = item.itemdesc || item.classification || item.particulars || 'Unspecified';
    if (!byItemMap.has(label)) {
      byItemMap.set(label, {
        item: label,
        total_amount: 0,
        transaction_ids: new Set(),
      });
    }
    const entry = byItemMap.get(label);
    entry.total_amount += toNumber(item.amount);
    entry.transaction_ids.add(item.transno);
  });

  const byItem = Array.from(byItemMap.values())
    .map((entry) => ({
      item: entry.item,
      total_amount: round2(entry.total_amount),
      transaction_count: entry.transaction_ids.size,
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  const byMonth = Array.from(byMonthMap.values())
    .map((entry) => ({
      ...entry,
      total_amount: round2(entry.total_amount),
      month_label: formatMonthLabel(entry.month_key),
    }))
    .sort((a, b) => a.month_key.localeCompare(b.month_key));

  return {
    summary: {
      transaction_count: transactions.length,
      line_count: processedItems.length,
      item_count: byItem.length,
      total_amount: round2(totalCollections),
    },
    byItem,
    byMonth,
  };
};

export const buildYearlyTableData = (processedItems, months = []) => {
  const itemMap = new Map();
  const monthKeys = new Set((months || []).map((month) => month.key));

  processedItems.forEach((item) => {
    const monthKey = normalizeDateKey(item.transdate || item.trans_day).slice(0, 7);
    if (!monthKey) return;
    monthKeys.add(monthKey);

    const label = item.itemdesc || item.classification || item.particulars || 'Unspecified';
    if (!itemMap.has(label)) {
      itemMap.set(label, {
        item: label,
        monthly: {},
        total_amount: 0,
      });
    }
    const entry = itemMap.get(label);
    entry.monthly[monthKey] = toNumber(entry.monthly[monthKey]) + toNumber(item.amount);
    entry.total_amount += toNumber(item.amount);
  });

  const resolvedMonths =
    months && months.length
      ? months
      : Array.from(monthKeys)
          .sort()
          .map((key) => ({ key, label: formatMonthLabel(key) }));

  const items = Array.from(itemMap.values())
    .map((entry) => ({
      item: entry.item,
      monthly: Object.fromEntries(
        Object.entries(entry.monthly).map(([key, value]) => [key, round2(value)])
      ),
      total_amount: round2(entry.total_amount),
    }))
    .sort((a, b) => toNumber(b.total_amount) - toNumber(a.total_amount));

  return { months: resolvedMonths, items };
};

export const resolveYearEndWindow = async (db, syid, schoolYear) => {
  const syStart = parseDateOnly(schoolYear.sdate);
  const syEnd = parseDateOnly(schoolYear.edate);
  if (!syStart || !syEnd) {
    return null;
  }

  const [previousRows] = await db.execute(
    'SELECT edate FROM sy WHERE edate < ? ORDER BY edate DESC LIMIT 1',
    [formatDateKey(syStart)]
  );

  let monthStart;
  const previousEnd = parseDateOnly(previousRows[0]?.edate);
  if (previousEnd) {
    monthStart = new Date(previousEnd.getFullYear(), previousEnd.getMonth() + 1, 1);
  } else {
    monthStart = new Date(syEnd.getFullYear(), syEnd.getMonth() - 11, 1);
  }

  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 12, 0);
  return {
    startDate: formatDateKey(monthStart),
    endDate: formatDateKey(monthEnd),
    months: buildMonthRange(monthStart, monthEnd, 12),
  };
};
