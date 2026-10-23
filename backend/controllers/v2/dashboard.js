/**
 * Finance V2 schools' Dashboard, assembled from the school's own pages:
 *   enrolled / pending, by level, by gender  registrarv2 Enrollment Statistics + status breakdown
 *   collections today / receivables           the school's finance dashboard
 *   collections this month                    cashier grand total, 1st of the month to today
 *   12-month collections                      the school's Year End report (month totals)
 *   employees by user type                    HR v3 employees (0 where HR v3 is off)
 *   events / memos                            the school calendar and memorandums
 */
import { callSchool, v2Handler } from '../../config/schoolApi.js'

const optional = (promise, fallback) => promise.catch((error) => {
  console.warn('Dashboard source skipped:', error.message)
  return fallback
})

const monthLabel = (key) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' })
}

export const getDashboardDataV2 = v2Handler(async (school, body) => {
  const [years, sems] = await Promise.all([callSchool(school, '/school-years'), callSchool(school, '/semesters')])
  const yearList = Array.isArray(years) ? years : years.data || []
  const semList = Array.isArray(sems) ? sems : sems.data || []
  const sy = yearList.find((y) => String(y.id) === String(body.syid)) || yearList.find((y) => Number(y.isactive) === 1) || yearList[0]
  const sem = semList.find((s) => String(s.id) === String(body.semid)) || semList.find((s) => Number(s.isactive) === 1) || semList[0]

  const now = new Date()
  const today = now.toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const [stats, status, finance, mtd, yearEnd, employees, events, memos] = await Promise.all([
    callSchool(school, '/enrollment/statistics', { query: { syid: sy?.id, semid: sem?.id } }),
    callSchool(school, '/enrollment/status-breakdown', { query: { sy_id: sy?.id } }),
    optional(callSchool(school, '/dashboard/finance-summary', { query: { syid: sy?.id, semid: sem?.id } }), null),
    optional(callSchool(school, '/cashier/transactions/grand-total', { query: { from: monthStart, to: today } }), null),
    optional(callSchool(school, '/yearly/transactions', { query: { syid: sy?.id, perPage: 1 } }), null),
    optional(callSchool(school, '/employees', { query: { per_page: 200 } }), null),
    optional(callSchool(school, '/calendar/upcoming', { query: { limit: 10 } }), []),
    optional(callSchool(school, '/memos'), { data: [] }),
  ])

  // More employee pages, for the per-type chart.
  let employeeRows = employees?.data || []
  for (let page = 2; employees && page <= (employees.last_page || 1) && page <= 20; page++) {
    const next = await optional(callSchool(school, '/employees', { query: { per_page: 200, page } }), null)
    if (!next) break
    employeeRows = employeeRows.concat(next.data || [])
  }
  const byType = new Map()
  for (const e of employeeRows) {
    const label = e.primary_portal_name || 'Unassigned'
    byType.set(label, (byType.get(label) || 0) + 1)
  }

  const levels = stats.yearLevels || []
  const yearTotals = stats.yearTotals || {}
  const statusTotals = status.data?.totals || []
  const monthlyTotals = yearEnd?.totals?.monthly_totals || {}
  const months = (yearEnd?.months || []).slice(-12)

  const eventList = (Array.isArray(events) ? events : events?.data || []).map((e) => ({
    id: e.id,
    title: e.title,
    when: new Date(String(e.start).replace(' ', 'T')).toLocaleDateString(),
    venue: e.venue,
  }))
  const memoList = memos?.data || []
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return {
    kpis: {
      enrolledStudents: Number(stats.grandTotals?.total) || 0,
      pendingEnrollments: Number(statusTotals[0]) || 0,
      employees: Number(employees?.total) || employeeRows.length,
      collectionsToday: Number(finance?.kpis?.today_collection) || 0,
      collectionsMTD: Number(mtd?.grand_total) || 0,
      receivables: Number(finance?.kpis?.total_receivable) || 0,
      upcomingEvents: eventList.length,
      memosThisWeek: memoList.filter((m) => String(m.created_at).slice(0, 10) >= weekAgo).length,
    },
    finance: {
      monthLabels: months.map(monthLabel),
      collectionsData: months.map((key) => Number(monthlyTotals[key]) || 0),
    },
    charts: {
      studentGender: [
        { label: 'Male', value: Number(stats.grandTotals?.male) || 0 },
        { label: 'Female', value: Number(stats.grandTotals?.female) || 0 },
      ],
      gradeLevels: levels
        .map((l) => ({ label: l.label, value: Number(yearTotals[l.id]?.total) || 0 }))
        .filter((g) => g.value > 0),
      departments: Array.from(byType, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    },
    lists: {
      events: eventList,
      memos: memoList.slice(0, 5).map((m) => ({ id: m.id, title: m.title, audience: m.user_ids ? 'Selected users' : 'All' })),
    },
    activeSchoolYear: sy || null,
    activeSemester: sem || null,
  }
}, 'dashboard')
