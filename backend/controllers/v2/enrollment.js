/**
 * Finance V2 schools' Enrollment Summary, from the school's own registrar pages.
 *
 *   summary   registrarv2 Home "status breakdown": per program, students per enrollment
 *             status (cards = enrolled + late enrollment + transferred in, as before)
 *   breakdown registrarv2 Enrollment Statistics: per grade level, SHS strand and course
 *   list      registrarv2 Enrollment Summary > students, per program
 */
import { callSchool, v2Handler } from '../../config/schoolApi.js'

const STATUS = { notEnrolled: 0, enrolled: 1, late: 2, dropped: 3, transferredIn: 4, transferredOut: 5, withdrawn: 6, deceased: 7 }

const programCard = (row, name) => {
  const c = row?.counts || []
  const at = (i) => Number(c[i]) || 0
  return {
    total: at(STATUS.enrolled) + at(STATUS.late) + at(STATUS.transferredIn),
    enrolled: at(STATUS.enrolled),
    late_enrollment: at(STATUS.late),
    transferred_in: at(STATUS.transferredIn),
    dropped_out: at(STATUS.dropped),
    transferred_out: at(STATUS.transferredOut),
    withdrawn: at(STATUS.withdrawn),
    deceased: at(STATUS.deceased),
    programName: row?.program || name,
  }
}

const sumCards = (cards) =>
  cards.reduce((acc, card) => {
    for (const [k, v] of Object.entries(card)) if (typeof v === 'number') acc[k] = (acc[k] || 0) + v
    return acc
  }, {})

const pickPeriod = async (school, body) => {
  const [years, sems] = await Promise.all([callSchool(school, '/school-years'), callSchool(school, '/semesters')])
  const yearList = Array.isArray(years) ? years : years.data || []
  const semList = Array.isArray(sems) ? sems : sems.data || []
  const sy = yearList.find((y) => String(y.id) === String(body.syid)) || yearList.find((y) => Number(y.isactive) === 1) || yearList[0]
  const sem = semList.find((s) => String(s.id) === String(body.semid)) || semList.find((s) => Number(s.isactive) === 1) || semList[0]
  return { sy, sem }
}

export const getEnrollmentSummaryV2 = v2Handler(async (school, body) => {
  const { sy, sem } = await pickPeriod(school, body)
  const [status, stats] = await Promise.all([
    callSchool(school, '/enrollment/status-breakdown', { query: { sy_id: sy?.id } }),
    callSchool(school, '/enrollment/statistics', { query: { syid: sy?.id, semid: sem?.id } }),
  ])
  const rows = status.data?.rows || []
  const byProgram = (id) => rows.find((r) => Number(r.acadprogid) === id)
  const kindergarten = programCard(byProgram(2), 'Kindergarten')
  const elementary = programCard(byProgram(3), 'Elementary')
  const highSchool = programCard(byProgram(4), 'High School')

  const levels = stats.yearLevels || []
  const yearTotals = stats.yearTotals || {}
  const levelCount = (id) => Number(yearTotals[id]?.total) || 0
  const statRows = stats.rows || []

  return {
    activeSchoolYear: sy || null,
    activeSemester: sem || null,
    summary: {
      kindergarten,
      elementary,
      highSchool,
      gradeSchool: sumCards([kindergarten, elementary, highSchool]),
      shs: programCard(byProgram(5), 'Senior High School'),
      college: programCard(byProgram(6), 'College'),
    },
    breakdown: {
      gradeSchoolByLevel: levels
        .filter((l) => [2, 3, 4].includes(Number(l.acadprogid)))
        .map((l) => ({ level_name: l.label, level_id: l.id, count: levelCount(l.id) })),
      shsByStrand: statRows
        .filter((r) => r.source === 'sh')
        .map((r) => ({ strand_name: r.course_name, strand_id: r.course_id, count: Number(r.row_total_t) || 0 })),
      collegeByYearLevel: statRows
        .filter((r) => r.source === 'college')
        .flatMap((r) =>
          levels
            .filter((l) => Number(r.years?.[l.id]?.total) > 0)
            .map((l) => ({ course_name: r.course_name, year_level_name: l.label, count: Number(r.years[l.id].total) }))
        ),
      gradeLevelAnalysis: levels.map((l, i) => ({ level_name: l.label, level_id: l.id, count: levelCount(l.id), sort_order: i })),
    },
  }
}, 'enrollment summary')

const LIST_PROGRAMS = { gradeschool: [2, 3, 4], shs: [5], college: [6] }

export const getEnrollmentListV2 = v2Handler(async (school, body) => {
  const { sy, sem } = await pickPeriod(school, body)
  const programs = LIST_PROGRAMS[body.level] || [2, 3, 4, 5, 6]
  const lists = await Promise.all(
    programs.map((program) =>
      callSchool(school, '/enrollment/students', { query: { syid: sy?.id, semid: sem?.id, program } })
    )
  )
  return lists
    .flatMap((res) => res.data || [])
    .map((s) => ({
      studid: s.id,
      student_number: s.sid,
      full_name: s.student_name,
      grade_level: s.level,
      year_level: s.level,
      section: s.section,
      strand: s.course_strand,
      course: s.course_strand,
      gender: s.gender,
      status: '',
      dateenrolled: null,
    }))
}, 'enrollment list')

export const getSchoolYearsV2 = v2Handler(async (school) => {
  const res = await callSchool(school, '/school-years')
  return Array.isArray(res) ? res : res.data || []
}, 'school years')

export const getSemestersV2 = v2Handler(async (school) => {
  const res = await callSchool(school, '/semesters')
  return Array.isArray(res) ? res : res.data || []
}, 'semesters')
