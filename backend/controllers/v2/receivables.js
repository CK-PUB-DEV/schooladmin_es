/**
 * Finance V2 Accounts Receivable, read from the school's own app.
 *
 *   summary  the school's finance dashboard (Financev2 DashboardController@summary):
 *            per-level student count, students with a balance, charges, payments,
 *            receivable; the school's overpayment total
 *   list     the school's Student Accounts list (same rows and balances as its page)
 *   filters  programs and grade levels from the school's filter list
 */
import { callSchool, v2Handler, withMeta, SchoolApiError } from '../../config/schoolApi.js'
import { round2 } from '../financeV2ReportUtils.js'

const num = (value) => {
  const n = Number(String(value ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

const isAll = (value) => value === undefined || value === null || value === '' || value === 'all'

/** gradelevel id -> { acadprogid, program } from the school's filters. */
const levelPrograms = async (school) => {
  const data = await callSchool(school, '/filters')
  const programs = new Map((data.academicPrograms || []).map((p) => [Number(p.id), p]))
  const levels = new Map()
  for (const level of Object.values(data.gradelevels || {}).flat()) {
    const program = programs.get(Number(level.acadprogid))
    levels.set(Number(level.id), {
      acadprogid: Number(level.acadprogid),
      program_name: program?.progname || program?.acadprogcode || '',
      sortid: level.sortid,
    })
  }
  return { data, levels }
}

export const getReceivableFiltersV2 = v2Handler(async (school) => {
  const { data } = await levelPrograms(school)
  return {
    programs: (data.academicPrograms || []).map(({ id, progname, acadprogcode }) => ({ id, progname, acadprogcode })),
    gradeLevels: Object.values(data.gradelevels || {})
      .flat()
      .map(({ id, levelname, acadprogid, sortid }) => ({ id, levelname, acadprogid, sortid })),
  }
}, 'receivables filters')

export const getReceivableSummaryV2 = v2Handler(async (school, body) => {
  if (!body.syid) throw new SchoolApiError(400, 'School year is required')
  const [dashboard, { levels }] = await Promise.all([
    callSchool(school, '/dashboard/finance-summary', { query: { syid: body.syid, semid: isAll(body.semid) ? undefined : body.semid } }),
    levelPrograms(school),
  ])

  const breakdown = (dashboard.breakdowns?.receivables_by_level || [])
    .map((row) => {
      const level = levels.get(Number(row.levelid)) || {}
      return {
        level_id: Number(row.levelid),
        levelname: row.levelname,
        acadprog_id: level.acadprogid ?? null,
        acadprogid: level.acadprogid ?? null,
        program_name: level.program_name || '',
        student_count: num(row.student_count),
        with_balance_count: num(row.with_balance_count),
        total_payables: round2(num(row.charges)),
        total_payment: round2(num(row.payments)),
        total_balance: round2(num(row.receivable)),
      }
    })
    .filter((row) => isAll(body.programId) || String(row.acadprog_id) === String(body.programId))
    .filter((row) => isAll(body.levelId) || String(row.level_id) === String(body.levelId))

  const narrowed = !isAll(body.programId) || !isAll(body.levelId)
  const sum = (field) => round2(breakdown.reduce((s, row) => s + row[field], 0))
  return {
    total_payables: narrowed ? sum('total_payables') : round2(num(dashboard.kpis?.total_charges)),
    total_payment: sum('total_payment'),
    total_balance: narrowed ? sum('total_balance') : round2(num(dashboard.kpis?.total_receivable)),
    total_overpayment: narrowed ? 0 : round2(num(dashboard.kpis?.overpayment_total)),
    student_count: sum('student_count'),
    students_with_balance: sum('with_balance_count'),
    breakdown,
    source: 'school',
  }
}, 'receivables summary')

export const getReceivableListV2 = v2Handler(async (school, body) => {
  if (!body.syid) throw new SchoolApiError(400, 'School year is required')
  const perPage = Math.min(Math.max(Number.parseInt(body.perPage, 10) || 100, 1), 500)
  const page = Math.max(Number.parseInt(body.page, 10) || 1, 1)
  const res = await callSchool(school, '/receivables/students', {
    query: {
      school_year: body.syid,
      semester: isAll(body.semid) ? undefined : body.semid,
      academic_program: isAll(body.programId) ? undefined : body.programId,
      academic_level: isAll(body.levelId) ? undefined : body.levelId,
      search: body.search,
      page,
      per_page: perPage,
    },
  })
  const rows = (res.data || []).map((s) => {
    const balance = round2(num(s.total_receivables))
    return {
      studid: s.id,
      sid: s.sid,
      student_name: s.fullname,
      level_id: s.levelid,
      level_name: s.academic_level,
      program_name: s.program_name,
      section_name: s.section_name,
      course_name: s.course_name,
      total_fees: round2(num(s.total_payables)),
      total_discount: round2(num(s.total_discount)),
      total_paid: round2(num(s.total_payments)),
      balance: balance > 0 ? balance : 0,
      overpayment: balance < 0 ? round2(-balance) : 0,
      last_calculated_at: null,
    }
  })
  const p = res.pagination || {}
  return withMeta(rows, {
    total: p.total ?? rows.length,
    page: p.current_page ?? page,
    per_page: p.per_page ?? perPage,
    pages: p.last_page ?? 1,
    source: 'school',
  })
}, 'receivables list')
