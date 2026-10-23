/**
 * Finance V2 Monthly and Year End collection summaries, from the school's own app.
 *
 *   Monthly  the school's receipts for the range (see collections.js), grouped by item and
 *            month; total = the school's own grand total when nothing narrows it.
 *   Yearly   the school's Year End Collection report (YecsReportsController): its item x
 *            month table, month totals and grand total, as the school prints it.
 */
import { callSchool, v2Handler, SchoolApiError } from '../../config/schoolApi.js'
import { buildCollectionSummaryData, round2 } from '../financeV2ReportUtils.js'
import { loadCollections } from './collections.js'

const monthLabel = (key) => {
  const [year, month] = String(key).split('-').map(Number)
  if (!year || !month) return key
  return new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

const keepStatus = (status) => (row) =>
  status === 'cancelled' ? row.cancelled === 1 : row.cancelled === 0

// ---- Monthly ----

const monthlyData = async (school, body) => {
  const data = await loadCollections(school, body)
  const keep = (row) =>
    keepStatus(body.status)(row) && (!body.paymentTypeId || String(row.paymenttype_id) === String(body.paymentTypeId))
  const transactions = data.transactions.filter(keep)
  const ids = new Set(transactions.map((t) => t.transno))
  const summaryData = buildCollectionSummaryData({
    transactions,
    processedItems: data.processedItems.filter((it) => ids.has(it.transno)),
  })
  if (!body.paymentTypeId && body.status !== 'cancelled') summaryData.summary.total_amount = data.grandTotal
  return summaryData
}

export const getMonthlySummaryV2 = v2Handler((school, body) => monthlyData(school, body), 'monthly summary')

export const getMonthlySummaryItemsV2 = v2Handler(async (school, body) => (await monthlyData(school, body)).byItem || [], 'monthly summary items')

// ---- Year End ----

const yearEnd = async (school, syid) => {
  if (!syid) throw new SchoolApiError(400, 'School year is required')
  const [filters, first] = await Promise.all([
    callSchool(school, '/filters'),
    callSchool(school, '/yearly/transactions', { query: { syid, page: 1, perPage: 500 } }),
  ])
  const rows = [...(first.data || [])]
  const total = Number(first.recordsTotal) || rows.length
  for (let page = 2; rows.length < total && page <= 40; page++) {
    const next = await callSchool(school, '/yearly/transactions', { query: { syid, page, perPage: 500 } })
    if (!next.data?.length) break
    rows.push(...next.data)
  }
  const sy = (filters.schoolyears || []).find((s) => String(s.id) === String(syid))
  if (!sy) throw new SchoolApiError(404, 'School year not found')
  const months = (first.months || []).map((key) => ({ key, label: monthLabel(key) }))
  return {
    schoolYear: { id: sy.id, sydesc: sy.sydesc, startDate: sy.sdate, endDate: sy.edate },
    months,
    rows,
    monthlyTotals: first.totals?.monthly_totals || {},
    grandTotal: round2(Number(first.totals?.grand_total) || 0),
  }
}

export const getYearlySummaryV2 = v2Handler(async (school, body) => {
  const y = await yearEnd(school, body.syid)
  const byItem = y.rows
    .map((r) => ({ item: r.description, total_amount: round2(Number(r.total_amount) || 0), transaction_count: null }))
    .sort((a, b) => b.total_amount - a.total_amount)
  const byMonth = y.months.map((m) => ({
    month_key: m.key,
    month_label: m.label,
    total_amount: round2(Number(y.monthlyTotals[m.key]) || 0),
    transaction_count: null,
  }))
  return {
    schoolYear: y.schoolYear,
    summary: { transaction_count: null, line_count: null, item_count: byItem.length, total_amount: y.grandTotal },
    byItem,
    byMonth,
  }
}, 'yearly summary')

export const getYearlySummaryTableV2 = v2Handler(async (school, body) => {
  const y = await yearEnd(school, body.syid)
  return {
    schoolYear: y.schoolYear,
    months: y.months,
    items: y.rows
      .map((r) => ({
        item: r.description,
        monthly: Object.fromEntries(Object.entries(r.monthly_amounts || {}).map(([k, v]) => [k, round2(Number(v) || 0)])),
        total_amount: round2(Number(r.total_amount) || 0),
      }))
      .sort((a, b) => b.total_amount - a.total_amount),
  }
}, 'yearly summary table')
