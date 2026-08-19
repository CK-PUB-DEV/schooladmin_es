import mysql from 'mysql2/promise';

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

const ACTIVE_ENROLLMENT_STATUSES = [1, 2, 4];
const ACTIVE_STATUS_SQL = ACTIVE_ENROLLMENT_STATUSES.join(', ');

const normalizeId = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const buildStatusCounts = (table) => `
  SELECT
    COALESCE(SUM(CASE WHEN studstatus IN (${ACTIVE_STATUS_SQL}) THEN 1 ELSE 0 END), 0) as total,
    COALESCE(SUM(CASE WHEN studstatus = 1 THEN 1 ELSE 0 END), 0) as enrolled,
    COALESCE(SUM(CASE WHEN studstatus = 2 THEN 1 ELSE 0 END), 0) as late_enrollment,
    COALESCE(SUM(CASE WHEN studstatus = 4 THEN 1 ELSE 0 END), 0) as transferred_in,
    COALESCE(SUM(CASE WHEN studstatus = 3 THEN 1 ELSE 0 END), 0) as dropped_out,
    COALESCE(SUM(CASE WHEN studstatus = 5 THEN 1 ELSE 0 END), 0) as transferred_out,
    COALESCE(SUM(CASE WHEN studstatus = 6 THEN 1 ELSE 0 END), 0) as withdrawn,
    COALESCE(SUM(CASE WHEN studstatus = 7 THEN 1 ELSE 0 END), 0) as deceased
  FROM ${table}
`;

// Get enrollment summary statistics
export const getEnrollmentSummary = async (req, res) => {
  let schoolDb;
  try {
    const { schoolDbConfig, syid, semid } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    schoolDb = await getSchoolConnection(schoolDbConfig);

    // Get active school year and semester
    const [activeSchoolYear] = await schoolDb.execute(
      'SELECT * FROM sy WHERE isactive = 1 LIMIT 1'
    );

    const [activeSemester] = await schoolDb.execute(
      'SELECT * FROM semester WHERE isactive = 1 LIMIT 1'
    );

    const activeSyId = normalizeId(syid, activeSchoolYear[0]?.id || 0);
    const activeSemId = normalizeId(semid, activeSemester[0]?.id || 0);

    const [selectedSchoolYear] = await schoolDb.execute(
      'SELECT * FROM sy WHERE id = ? LIMIT 1',
      [activeSyId]
    );

    const [selectedSemester] = await schoolDb.execute(
      'SELECT * FROM semester WHERE id = ? LIMIT 1',
      [activeSemId]
    );

    const [programRows] = await schoolDb.execute(
      'SELECT id, progname FROM academicprogram WHERE id IN (2, 3, 4, 5, 6)'
    );
    const programMap = new Map(programRows.map((row) => [row.id, row.progname]));

    const [kindergartenCount] = await schoolDb.execute(
      `${buildStatusCounts('enrolledstud')} e
       LEFT JOIN gradelevel l ON e.levelid = l.id
       WHERE e.deleted = 0 AND e.syid = ? AND l.acadprogid = 2`,
      [activeSyId]
    );

    const [elementaryCount] = await schoolDb.execute(
      `${buildStatusCounts('enrolledstud')} e
       LEFT JOIN gradelevel l ON e.levelid = l.id
       WHERE e.deleted = 0 AND e.syid = ? AND l.acadprogid = 3`,
      [activeSyId]
    );

    const [highSchoolCount] = await schoolDb.execute(
      `${buildStatusCounts('enrolledstud')} e
       LEFT JOIN gradelevel l ON e.levelid = l.id
       WHERE e.deleted = 0 AND e.syid = ? AND l.acadprogid = 4`,
      [activeSyId]
    );

    // Get enrollment counts by level
    const [gradeSchoolCount] = await schoolDb.execute(
      `${buildStatusCounts('enrolledstud')}
      WHERE deleted = 0 AND syid = ?`,
      [activeSyId]
    );

    const [shsCount] = await schoolDb.execute(
      `${buildStatusCounts('sh_enrolledstud')} e
       LEFT JOIN gradelevel l ON e.levelid = l.id
       WHERE e.deleted = 0
         AND e.syid = ?
         AND (e.semid = ? OR e.semid IS NULL)
         AND l.acadprogid = 5`,
      [activeSyId, activeSemId]
    );

    const [collegeCount] = await schoolDb.execute(
      `${buildStatusCounts('college_enrolledstud')} e
       WHERE e.deleted = 0 AND e.syid = ? AND e.semid = ?`,
      [activeSyId, activeSemId]
    );

    // Get enrollment by grade level (for grade school)
    const [gradeSchoolByLevel] = await schoolDb.execute(
      `SELECT
        l.levelname as level_name,
        l.id as level_id,
        COUNT(e.id) as count
      FROM enrolledstud e
      LEFT JOIN gradelevel l ON e.levelid = l.id
      WHERE e.deleted = 0 AND e.syid = ? AND e.studstatus IN (${ACTIVE_STATUS_SQL})
      GROUP BY e.levelid, l.levelname, l.id
      ORDER BY l.sortid`,
      [activeSyId]
    );

    // Get enrollment by strand (for SHS)
    const [shsByStrand] = await schoolDb.execute(
      `SELECT
        s.strandname as strand_name,
        s.id as strand_id,
        COUNT(e.id) as count
      FROM sh_enrolledstud e
      LEFT JOIN sh_strand s ON e.strandid = s.id
      WHERE e.deleted = 0
        AND e.syid = ?
        AND (e.semid = ? OR e.semid IS NULL)
        AND e.studstatus IN (${ACTIVE_STATUS_SQL})
      GROUP BY e.strandid, s.strandname, s.id
      ORDER BY s.strandname`,
      [activeSyId, activeSemId]
    );

    // Get enrollment by course (for college)
    const [collegeByYearLevel] = await schoolDb.execute(
      `SELECT
        COALESCE(c.coursedesc, c.courseDesc, c.courseabrv, 'N/A') as course_name,
        gl.levelname as year_level_name,
        e.yearLevel,
        COUNT(e.id) as count
      FROM college_enrolledstud e
      LEFT JOIN college_sections sec ON e.sectionID = sec.id
      LEFT JOIN college_courses c ON COALESCE(sec.courseid, e.courseid) = c.id
      LEFT JOIN gradelevel gl ON e.yearLevel = gl.id
      WHERE e.deleted = 0
        AND e.syid = ?
        AND e.semid = ?
        AND e.studstatus IN (${ACTIVE_STATUS_SQL})
      GROUP BY COALESCE(sec.courseid, e.courseid), c.coursedesc, c.courseDesc, c.courseabrv, e.yearLevel, gl.levelname
      ORDER BY c.coursedesc, c.courseDesc, c.courseabrv, gl.sortid, e.yearLevel`,
      [activeSyId, activeSemId]
    );

    const [gradeLevelAnalysis] = await schoolDb.execute(
      `SELECT
        level_name,
        level_id,
        SUM(level_count) as count,
        sort_order
      FROM (
        SELECT
          COALESCE(l.levelname, CONCAT('Level ', e.levelid)) as level_name,
          e.levelid as level_id,
          COUNT(e.id) as level_count,
          COALESCE(l.sortid, 0) as sort_order
        FROM enrolledstud e
        LEFT JOIN gradelevel l ON e.levelid = l.id
        WHERE e.deleted = 0 AND e.syid = ? AND e.studstatus IN (${ACTIVE_STATUS_SQL})
        GROUP BY e.levelid, l.levelname, l.sortid

        UNION ALL

        SELECT
          COALESCE(l.levelname, CONCAT('Level ', e.levelid)) as level_name,
          e.levelid as level_id,
          COUNT(e.id) as level_count,
          COALESCE(l.sortid, 0) as sort_order
        FROM sh_enrolledstud e
        LEFT JOIN gradelevel l ON e.levelid = l.id
        WHERE e.deleted = 0
          AND e.syid = ?
          AND (e.semid = ? OR e.semid IS NULL)
          AND e.studstatus IN (${ACTIVE_STATUS_SQL})
        GROUP BY e.levelid, l.levelname, l.sortid

        UNION ALL

        SELECT
          COALESCE(l.levelname, CONCAT('Level ', e.yearLevel)) as level_name,
          e.yearLevel as level_id,
          COUNT(e.id) as level_count,
          COALESCE(l.sortid, 100 + COALESCE(e.yearLevel, 0)) as sort_order
        FROM college_enrolledstud e
        LEFT JOIN gradelevel l ON e.yearLevel = l.id
        WHERE e.deleted = 0
          AND e.syid = ?
          AND e.semid = ?
          AND e.studstatus IN (${ACTIVE_STATUS_SQL})
          AND e.yearLevel IS NOT NULL
        GROUP BY e.yearLevel, l.levelname, l.sortid
      ) as levels
      GROUP BY level_name, level_id, sort_order
      ORDER BY sort_order, level_name`,
      [activeSyId, activeSyId, activeSemId, activeSyId, activeSemId]
    );

    res.status(200).json({
      status: 'success',
      data: {
        activeSchoolYear: selectedSchoolYear[0] || activeSchoolYear[0] || null,
        activeSemester: selectedSemester[0] || activeSemester[0] || null,
        summary: {
          kindergarten: {
            ...kindergartenCount[0],
            programName: programMap.get(2) || 'Kindergarten',
          },
          elementary: {
            ...elementaryCount[0],
            programName: programMap.get(3) || 'Elementary',
          },
          highSchool: {
            ...highSchoolCount[0],
            programName: programMap.get(4) || 'High School',
          },
          gradeSchool: gradeSchoolCount[0],
          shs: {
            ...shsCount[0],
            programName: programMap.get(5) || 'Senior High School',
          },
          college: {
            ...collegeCount[0],
            programName: programMap.get(6) || 'College',
          },
        },
        breakdown: {
          gradeSchoolByLevel,
          shsByStrand,
          collegeByYearLevel,
          gradeLevelAnalysis,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching enrollment summary:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch enrollment summary',
      error: error.message,
    });
  } finally {
    if (schoolDb) {
      await schoolDb.end();
    }
  }
};

// Get detailed enrollment list
export const getEnrollmentList = async (req, res) => {
  let schoolDb;
  try {
    const { schoolDbConfig, level, syid, semid } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    schoolDb = await getSchoolConnection(schoolDbConfig);

    let query = '';
    let params = [];

    if (level === 'gradeschool') {
      query = `
        SELECT
          e.id,
          e.studid,
          s.sid as student_number,
          CONCAT(s.lastname, ', ', s.firstname, ' ', IFNULL(s.middlename, '')) as full_name,
          s.gender,
          l.levelname as grade_level,
          sec.sectionname as section,
          st.description as status,
          e.dateenrolled
        FROM enrolledstud e
        LEFT JOIN studinfo s ON e.studid = s.id
        LEFT JOIN gradelevel l ON e.levelid = l.id
        LEFT JOIN sections sec ON e.sectionid = sec.id
        LEFT JOIN studentstatus st ON e.studstatus = st.id
        WHERE e.deleted = 0 AND e.syid = ? AND e.studstatus IN (${ACTIVE_STATUS_SQL})
        ORDER BY l.sortid, sec.sectionname, s.lastname, s.firstname
      `;
      params = [syid];
    } else if (level === 'shs') {
      query = `
        SELECT
          e.id,
          e.studid,
          s.sid as student_number,
          CONCAT(s.lastname, ', ', s.firstname, ' ', IFNULL(s.middlename, '')) as full_name,
          s.gender,
          l.levelname as grade_level,
          str.strandname as strand,
          sec.sectionname as section,
          st.description as status,
          e.dateenrolled
        FROM sh_enrolledstud e
        LEFT JOIN studinfo s ON e.studid = s.id
        LEFT JOIN gradelevel l ON e.levelid = l.id
        LEFT JOIN sh_strand str ON e.strandid = str.id
        LEFT JOIN sections sec ON e.sectionid = sec.id
        LEFT JOIN studentstatus st ON e.studstatus = st.id
        WHERE e.deleted = 0
          AND e.syid = ?
          AND (e.semid = ? OR e.semid IS NULL)
          AND e.studstatus IN (${ACTIVE_STATUS_SQL})
        ORDER BY l.sortid, str.strandname, sec.sectionname, s.lastname, s.firstname
      `;
      params = [syid, semid];
    } else if (level === 'college') {
      query = `
        SELECT
          e.id,
          e.studid,
          s.sid as student_number,
          CONCAT(s.lastname, ', ', s.firstname, ' ', IFNULL(s.middlename, '')) as full_name,
          s.gender,
          COALESCE(l.levelname, CONCAT('Level ', e.yearLevel)) as year_level,
          COALESCE(c.coursedesc, c.courseDesc, c.courseabrv, 'N/A') as course,
          sec.sectionDesc as section,
          st.description as status,
          e.date_enrolled as dateenrolled
        FROM college_enrolledstud e
        LEFT JOIN studinfo s ON e.studid = s.id
        LEFT JOIN college_sections sec ON e.sectionID = sec.id
        LEFT JOIN college_courses c ON COALESCE(sec.courseid, e.courseid) = c.id
        LEFT JOIN gradelevel l ON e.yearLevel = l.id
        LEFT JOIN studentstatus st ON e.studstatus = st.id
        WHERE e.deleted = 0
          AND e.syid = ?
          AND e.semid = ?
          AND e.studstatus IN (${ACTIVE_STATUS_SQL})
        ORDER BY c.coursedesc, c.courseDesc, c.courseabrv, l.sortid, s.lastname, s.firstname
      `;
      params = [syid, semid];
    } else {
      await schoolDb.end();
      return res.status(400).json({
        status: 'error',
        message: 'Invalid level specified. Must be gradeschool, shs, or college',
      });
    }

    const [enrollments] = await schoolDb.execute(query, params);

    res.status(200).json({
      status: 'success',
      data: enrollments,
    });
  } catch (error) {
    console.error('Error fetching enrollment list:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch enrollment list',
      error: error.message,
    });
  } finally {
    if (schoolDb) {
      await schoolDb.end();
    }
  }
};

// Get available school years
export const getSchoolYears = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const schoolDb = await getSchoolConnection(schoolDbConfig);

    const [schoolYears] = await schoolDb.execute(
      'SELECT * FROM sy ORDER BY id DESC'
    );

    await schoolDb.end();

    res.status(200).json({
      status: 'success',
      data: schoolYears,
    });
  } catch (error) {
    console.error('Error fetching school years:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch school years',
      error: error.message,
    });
  }
};

// Get available semesters
export const getSemesters = async (req, res) => {
  try {
    const { schoolDbConfig } = req.body;

    if (!schoolDbConfig) {
      return res.status(400).json({
        status: 'error',
        message: 'School database configuration is required',
      });
    }

    const schoolDb = await getSchoolConnection(schoolDbConfig);

    const [semesters] = await schoolDb.execute(
      'SELECT * FROM semester WHERE deleted = 0 ORDER BY id'
    );

    await schoolDb.end();

    res.status(200).json({
      status: 'success',
      data: semesters,
    });
  } catch (error) {
    console.error('Error fetching semesters:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch semesters',
      error: error.message,
    });
  }
};
