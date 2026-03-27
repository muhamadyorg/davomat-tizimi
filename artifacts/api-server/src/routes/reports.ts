import { Router, type IRouter, type Response } from "express";
import { db, attendanceTable, usersTable, departmentsTable, leaveRequestsTable } from "@workspace/db";
import { eq, and, gte, lte, count, sql, SQL } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/summary", async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, departmentId } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ message: "startDate and endDate required" });
    return;
  }

  const userConditions: SQL[] = [eq(usersTable.isActive, true)];
  if (departmentId) {
    userConditions.push(eq(usersTable.departmentId, Number(departmentId)));
  }

  const employees = await db
    .select({ id: usersTable.id, departmentId: usersTable.departmentId })
    .from(usersTable)
    .where(and(...userConditions));

  const totalEmployees = employees.length;

  const attConditions: SQL[] = [
    gte(attendanceTable.date, startDate as string),
    lte(attendanceTable.date, endDate as string),
  ];

  const attendance = await db
    .select({
      status: attendanceTable.status,
      cnt: count(),
    })
    .from(attendanceTable)
    .innerJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .where(and(...attConditions, ...userConditions))
    .groupBy(attendanceTable.status);

  const statusMap: Record<string, number> = {};
  attendance.forEach((a) => {
    statusMap[a.status] = Number(a.cnt);
  });

  const presentCount = (statusMap["present"] || 0) + (statusMap["late"] || 0) + (statusMap["early_leave"] || 0);
  const absentCount = statusMap["absent"] || 0;
  const lateCount = statusMap["late"] || 0;
  const onLeaveCount = statusMap["on_leave"] || 0;

  const totalRecords = Object.values(statusMap).reduce((a, b) => a + b, 0);
  const attendanceRate = totalRecords > 0 ? Math.round((presentCount / totalRecords) * 10000) / 100 : 0;

  const avgWorkRes = await db
    .select({ avg: sql<number>`AVG(work_hours)` })
    .from(attendanceTable)
    .where(and(...attConditions, ...userConditions.map((c) => {
      return sql`user_id IN (SELECT id FROM users WHERE is_active = true)`;
    })));
  const avgWorkHours = Math.round((Number(avgWorkRes[0]?.avg) || 0) * 100) / 100;

  const departments = await db
    .select({
      id: departmentsTable.id,
      name: departmentsTable.name,
    })
    .from(departmentsTable);

  const byDepartment = await Promise.all(
    departments.map(async (dept) => {
      const deptEmployees = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.departmentId, dept.id), eq(usersTable.isActive, true)));

      const deptAtt = await db
        .select({ status: attendanceTable.status, cnt: count() })
        .from(attendanceTable)
        .innerJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
        .where(and(
          eq(usersTable.departmentId, dept.id),
          gte(attendanceTable.date, startDate as string),
          lte(attendanceTable.date, endDate as string),
        ))
        .groupBy(attendanceTable.status);

      const deptStatusMap: Record<string, number> = {};
      deptAtt.forEach((a) => { deptStatusMap[a.status] = Number(a.cnt); });

      const deptPresent = (deptStatusMap["present"] || 0) + (deptStatusMap["late"] || 0) + (deptStatusMap["early_leave"] || 0);
      const deptAbsent = deptStatusMap["absent"] || 0;
      const deptTotal = Object.values(deptStatusMap).reduce((a, b) => a + b, 0);
      const deptRate = deptTotal > 0 ? Math.round((deptPresent / deptTotal) * 10000) / 100 : 0;

      return {
        departmentId: dept.id,
        departmentName: dept.name,
        totalEmployees: deptEmployees.length,
        presentCount: deptPresent,
        absentCount: deptAbsent,
        attendanceRate: deptRate,
      };
    })
  );

  res.json({
    totalEmployees,
    presentCount,
    absentCount,
    lateCount,
    onLeaveCount,
    attendanceRate,
    avgWorkHours,
    byDepartment,
  });
});

router.get("/employee/:userId", async (req: AuthRequest, res: Response) => {
  const userId = Number(req.params.userId);
  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ message: "startDate and endDate required" });
    return;
  }

  if (req.user!.role === "employee" && req.user!.id !== userId) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  const userRows = await db
    .select({
      id: usersTable.id,
      username: usersTable.username,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      email: usersTable.email,
      phone: usersTable.phone,
      role: usersTable.role,
      departmentId: usersTable.departmentId,
      departmentName: departmentsTable.name,
      shiftId: usersTable.shiftId,
      position: usersTable.position,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!userRows[0]) {
    res.status(404).json({ message: "User not found" });
    return;
  }

  const user = {
    ...userRows[0],
    shiftName: null,
  };

  const records = await db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentName: departmentsTable.name,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      status: attendanceTable.status,
      lateMinutes: attendanceTable.lateMinutes,
      earlyLeaveMinutes: attendanceTable.earlyLeaveMinutes,
      workHours: attendanceTable.workHours,
      note: attendanceTable.note,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(and(
      eq(attendanceTable.userId, userId),
      gte(attendanceTable.date, startDate as string),
      lte(attendanceTable.date, endDate as string),
    ))
    .orderBy(attendanceTable.date);

  const mapped = records.map((r) => ({
    ...r,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
  }));

  const statusMap: Record<string, number> = {};
  let totalWorkHours = 0;
  mapped.forEach((r) => {
    statusMap[r.status] = (statusMap[r.status] || 0) + 1;
    totalWorkHours += r.workHours ?? 0;
  });

  const totalDays = mapped.length;
  const presentDays = (statusMap["present"] || 0) + (statusMap["late"] || 0) + (statusMap["early_leave"] || 0);
  const absentDays = statusMap["absent"] || 0;
  const lateDays = statusMap["late"] || 0;
  const onLeaveDays = statusMap["on_leave"] || 0;
  const avgWorkHours = totalDays > 0 ? Math.round((totalWorkHours / totalDays) * 100) / 100 : 0;
  const attendanceRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 10000) / 100 : 0;

  res.json({
    user,
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    onLeaveDays,
    totalWorkHours: Math.round(totalWorkHours * 100) / 100,
    avgWorkHours,
    attendanceRate,
    records: mapped,
  });
});

router.get("/daily", async (req: AuthRequest, res: Response) => {
  const { date, departmentId } = req.query;

  if (!date) {
    res.status(400).json({ message: "date required" });
    return;
  }

  const conditions: SQL[] = [eq(attendanceTable.date, date as string)];
  if (departmentId) conditions.push(eq(usersTable.departmentId, Number(departmentId)));

  const records = await db
    .select({
      userId: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentName: departmentsTable.name,
      position: usersTable.position,
      status: attendanceTable.status,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      workHours: attendanceTable.workHours,
      lateMinutes: attendanceTable.lateMinutes,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(and(...conditions));

  const result = records.map((r) => ({
    userId: r.userId,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    departmentName: r.departmentName,
    position: r.position,
    status: r.status,
    checkIn: r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : null,
    checkOut: r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : null,
    workHours: r.workHours ?? 0,
    lateMinutes: r.lateMinutes ?? 0,
  }));

  res.json(result);
});

router.get("/dashboard", async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const firstOfMonth = today.slice(0, 8) + "01";

  const totalEmployees = await db
    .select({ count: count() })
    .from(usersTable)
    .where(and(eq(usersTable.isActive, true), eq(usersTable.role, "employee")));

  const todayAtt = await db
    .select({ status: attendanceTable.status, cnt: count() })
    .from(attendanceTable)
    .where(eq(attendanceTable.date, today))
    .groupBy(attendanceTable.status);

  const todayMap: Record<string, number> = {};
  todayAtt.forEach((a) => { todayMap[a.status] = Number(a.cnt); });

  const pendingLeave = await db
    .select({ count: count() })
    .from(leaveRequestsTable)
    .where(eq(leaveRequestsTable.status, "pending"));

  const monthlyAtt = await db
    .select({ status: attendanceTable.status, cnt: count() })
    .from(attendanceTable)
    .where(and(gte(attendanceTable.date, firstOfMonth), lte(attendanceTable.date, today)))
    .groupBy(attendanceTable.status);

  const monthlyMap: Record<string, number> = {};
  monthlyAtt.forEach((a) => { monthlyMap[a.status] = Number(a.cnt); });
  const monthlyTotal = Object.values(monthlyMap).reduce((a, b) => a + b, 0);
  const monthlyPresent = (monthlyMap["present"] || 0) + (monthlyMap["late"] || 0) + (monthlyMap["early_leave"] || 0);
  const monthlyRate = monthlyTotal > 0 ? Math.round((monthlyPresent / monthlyTotal) * 10000) / 100 : 0;

  const recentAtt = await db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentName: departmentsTable.name,
      date: attendanceTable.date,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      status: attendanceTable.status,
      lateMinutes: attendanceTable.lateMinutes,
      earlyLeaveMinutes: attendanceTable.earlyLeaveMinutes,
      workHours: attendanceTable.workHours,
      note: attendanceTable.note,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(eq(attendanceTable.date, today))
    .orderBy(attendanceTable.createdAt)
    .limit(10);

  const recentAttendance = recentAtt.map((r) => ({
    ...r,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
  }));

  res.json({
    todayPresent: (todayMap["present"] || 0) + (todayMap["late"] || 0) + (todayMap["early_leave"] || 0),
    todayAbsent: todayMap["absent"] || 0,
    todayLate: todayMap["late"] || 0,
    todayOnLeave: todayMap["on_leave"] || 0,
    totalEmployees: Number(totalEmployees[0]?.count || 0),
    pendingLeaveRequests: Number(pendingLeave[0]?.count || 0),
    thisMonthAttendanceRate: monthlyRate,
    recentAttendance,
  });
});

export { router as reportsRouter };
export default router;
