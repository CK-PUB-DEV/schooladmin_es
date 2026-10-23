/**
 * Finance V2 collections (Cashier Transactions, Daily Cash Progress), read from the
 * school's own app instead of its database.
 *
 *   cashier/transactions  every receipt: OR number, payment type, cashier, void flag
 *   dcpr/transactions     the receipts the school counts (not cancelled), with their
 *                         items, fee classifications and cashier window
 *   cashier/.../grand-total  the school's own total collections for the range
 *
 * The two lists are joined on the receipt id and turned into the rows the pages already
 * use, so the existing helpers only group and add up what the school returned.
 */
import { callSchool, v2Handler } from '../../config/schoolApi.js'
import {
  buildCollectionAggregations,
  buildDailyCashSummary,
  normalizeDateKey,
  round2,
} from '../financeV2ReportUtils.js'

const CACHE_TTL_MS = 60 * 1000
const cache = new Map()

const cached = async (key, load) => {
  const hit = cache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await load()
  cache.set(key, { value, expires: Date.now() + CACHE_TTL_MS })
  if (cache.size > 200) {
    for (const [k, v] of cache) if (v.expires <= Date.now()) cache.delete(k)
  }
  return value
}

const toNumber = (value) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

const today = () => new Date().toISOString().slice(0, 10)

/** The date range a page asks for: one date, or start/end (either alone = that day). */
export const resolveRange = ({ date, startDate, endDate }) => {
  const start = normalizeDateKey(startDate || date || endDate) || today()
  const end = normalizeDateKey(endDate || date || startDate) || start
  return start <= end ? { start, end } : { start: end, end: start }
}

const fetchCashierReceipts = async (school, { start, end, syid }) => {
  const rows = []
  for (let page = 1; page <= 100; page++) {
    const res = await callSchool(school, '/cashier/transactions', {
      query: { from: start, to: end, syid, page, per_page: 1000 },
    })
    rows.push(...(res.data || []))
    if (page >= (res.meta?.last_page || 1)) break
  }
  return rows
}

const fetchDcprReceipts = async (school, { start, end, terminalId }) => {
  const rows = []
  const perPage = 9999
  for (let page = 1; page <= 50; page++) {
    const res = await callSchool(school, '/dcpr/transactions', {
      query: { date_from: start, date_to: end, cashier_terminal_id: terminalId, page, perPage },
    })
    rows.push(...(res.data || []))
    if (page * perPage >= toNumber(res.recordsTotal)) break
  }
  return rows
}

/**
 * Receipts + items for a range, in the portal's row shapes. `status`: posted (not
 * voided), cancelled (voided only) or anything else = all.
 */
export const loadCollections = (school, params) => {
  const { start, end } = resolveRange(params)
  const terminalId = params.terminalId || null
  const key = JSON.stringify([school.id, start, end, params.syid || null, terminalId])

  return cached(key, async () => {
    const [receipts, dcpr, grand] = await Promise.all([
      fetchCashierReceipts(school, { start, end, syid: params.syid }),
      fetchDcprReceipts(school, { start, end, terminalId }),
      callSchool(school, '/cashier/transactions/grand-total', { query: { from: start, to: end, syid: params.syid } }),
    ])
    const dcprById = new Map(dcpr.map((row) => [String(row.transno), row]))

    const transactions = []
    const processedItems = []
    for (const r of receipts) {
      const d = dcprById.get(String(r.id))
      // A terminal filter applies through the school's DCPR (it knows each receipt's
      // window); voided receipts have no window there.
      if (terminalId && !d) continue
      const cancelled = Number(r.is_voided) === 1 ? 1 : 0
      const amount = round2(toNumber(r.amount))
      const day = normalizeDateKey(r.date)
      const items = d?.items || []
      const transaction = {
        transno: r.id,
        ornum: r.or_number,
        transdate: r.date,
        trans_day: day,
        sid: d?.sid || null,
        student_name: r.student_name,
        full_name: r.student_name,
        studname: r.student_name,
        grade_level: r.grade_level,
        section_name: r.section_name,
        course: r.course,
        totalamount: amount,
        net_amount: amount,
        amountpaid: toNumber(r.amount_paid),
        change_amount: toNumber(r.change_amount),
        overpayment_amount: 0,
        payment_type: r.payment_type,
        paymenttype_id: r.paymenttype_id,
        terminal: d?.cashier_num || null,
        cashier: r.cashier_name,
        transacted_by: r.cashier_name,
        cancelled,
        posted: cancelled ? 0 : 1,
        is_refunded: Number(r.is_refunded) === 1 ? 1 : 0,
        is_online_pay: r.is_online_pay,
        items: items.map((it) => it.itemdesc || it.particulars || it.classif_desc).filter(Boolean).join(', '),
      }
      transactions.push(transaction)
      for (const it of items) {
        processedItems.push({
          transno: r.id,
          ornum: r.or_number,
          transdate: r.date,
          trans_day: day,
          sid: d?.sid || null,
          student_name: r.student_name,
          classid: it.classid,
          classification: it.classif_desc || 'Uncategorized',
          particulars: it.particulars,
          itemdesc: it.itemdesc || it.particulars,
          amount: round2(toNumber(it.amount)),
          paid_amount: round2(toNumber(it.amount)),
          overpayment: 0,
          payment_type: r.payment_type,
          paymenttype_id: r.paymenttype_id,
          cancelled,
        })
      }
    }
    return { start, end, transactions, processedItems, grandTotal: round2(toNumber(grand.grand_total)) }
  })
}

/** Payment type / status filters applied to the school's rows. */
const applyFilters = (data, { paymentTypeId, status }) => {
  const keep = (row) =>
    (!paymentTypeId || String(row.paymenttype_id) === String(paymentTypeId)) &&
    (status === 'cancelled' ? row.cancelled === 1 : status === 'posted' ? row.cancelled === 0 : true)
  const transactions = data.transactions.filter(keep)
  const ids = new Set(transactions.map((t) => t.transno))
  return { transactions, processedItems: data.processedItems.filter((it) => ids.has(it.transno)) }
}

// ---- Cashier Transactions ----

export const getCashierSummaryV2 = v2Handler(async (school, body) => {
  const data = await loadCollections(school, body)
  const filtered = applyFilters(data, body)
  const notVoided = filtered.transactions.filter((t) => t.cancelled === 0)
  const voided = filtered.transactions.filter((t) => t.cancelled === 1)
  const unfiltered = !body.paymentTypeId && !body.terminalId && body.status !== 'cancelled'
  const aggregations = buildCollectionAggregations({
    transactions: notVoided,
    processedItems: filtered.processedItems.filter((it) => it.cancelled === 0),
  })
  return {
    summary: {
      total_transactions: filtered.transactions.length,
      // The school's own total when nothing narrows it; otherwise the school's receipt
      // amounts for the receipts the filter keeps.
      total_collections: unfiltered ? data.grandTotal : round2(notVoided.reduce((s, t) => s + t.net_amount, 0)),
      cancelled_amount: round2(voided.reduce((s, t) => s + t.net_amount, 0)),
      cancelled_count: voided.length,
      overpayment_amount: 0,
      overpayment_count: 0,
    },
    byPaymentType: aggregations.byPaymentType,
    byClassification: aggregations.byClassification,
    byTerminal: aggregations.byTerminal,
    dailyCollections: aggregations.byDay.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7),
  }
}, 'cashier summary')

export const getTransactionListV2 = v2Handler(async (school, body) => {
  const data = await loadCollections(school, body)
  return applyFilters(data, body).transactions
}, 'transaction list')

export const getPaymentTypesV2 = v2Handler(async (school) => {
  const res = await callSchool(school, '/cashier/payment-types')
  return res.data || []
}, 'payment types')

/** Cashier windows as the school's DCPR lists them. */
export const getTerminalsV2 = v2Handler(async (school) => {
  const res = await callSchool(school, '/dcpr/filters')
  return (res.data?.cashiers || []).map((c) => ({ id: c.id, description: c.cashier_name, owner: c.owner || c.cashier_name }))
}, 'terminals')

// ---- Daily Cash Progress ----

export const getDailyCashSummaryV2 = v2Handler(async (school, body) => {
  const data = await loadCollections(school, body)
  const filtered = applyFilters(data, { ...body, status: 'posted' })
  const summary = buildDailyCashSummary(filtered)
  if (!body.paymentTypeId) summary.total_collections = data.grandTotal
  const aggregations = buildCollectionAggregations(filtered)
  return {
    summary,
    byDay: aggregations.byDay,
    byClassification: aggregations.byClassification,
    byPaymentType: aggregations.byPaymentType,
  }
}, 'daily cash summary')

export const getDailyCashItemsV2 = v2Handler(async (school, body) => {
  const data = await loadCollections(school, body)
  return applyFilters(data, { ...body, status: 'posted' }).processedItems
}, 'daily cash items')
