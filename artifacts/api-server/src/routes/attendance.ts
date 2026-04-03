import { Router, type IRouter, type Response } from "express";
import { db, attendanceTable, usersTable, departmentsTable, shiftsTable } from "@workspace/db";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();
router.use(requireAuth);

function calcWorkHours(checkIn: Date | null, checkOut: Date | null): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100;
}

function calcLateMinutes(checkIn: Date, shiftStart: string, date: string): number {
  const expected = new Date(`${date}T${shiftStart}:00`);
  const diff = Math.floor((checkIn.getTime() - expected.getTime()) / 60000);
  return Math.max(0, diff);
}

async function getAttendanceRecords(conditions: SQL[]) {
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
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
      editCount: attendanceTable.editCount,
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(whereClause)
    .orderBy(attendanceTable.date);

  return records.map(r => ({
    ...r,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
  }));
}

// Admin: get all employees with their attendance for a given date (grouped)
router.get("/daily", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
  const deptId = req.query.departmentId ? Number(req.query.departmentId) : undefined;

  const conditions: any[] = [eq(usersTable.isActive, true)];
  if (deptId) conditions.push(eq(usersTable.departmentId, deptId));

  const employees = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      phone: usersTable.phone,
      departmentId: usersTable.departmentId,
      departmentName: departmentsTable.name,
      shiftName: shiftsTable.name,
      shiftStartTime: shiftsTable.startTime,
      shiftEndTime: shiftsTable.endTime,
      position: usersTable.position,
      role: usersTable.role,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(and(...conditions));

  const attendanceRecords = await db
    .select()
    .from(attendanceTable)
    .where(eq(attendanceTable.date, date));

  const attendanceMap = new Map(attendanceRecords.map(r => [r.userId, r]));

  const result = employees.map(emp => {
    const att = attendanceMap.get(emp.id) || null;
    return {
      employee: emp,
      attendance: att ? {
        id: att.id,
        checkIn: att.checkIn,
        checkOut: att.checkOut,
        status: att.status,
        note: att.note,
        lateMinutes: att.lateMinutes,
        workHours: att.workHours,
        partialValue: att.partialValue,
        editCount: att.editCount,
      } : null,
    };
  });

  res.json(result);
});

// Admin: mark/update attendance for an employee on a date (with editCount limit)
router.post("/mark", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const { userId, date, status, checkIn, checkOut, note, partialValue } = req.body;
  const actorRole = req.user!.role;

  if (!userId || !date || !status) {
    res.status(400).json({ message: "userId, date va status kerak" });
    return;
  }

  const checkInDate = checkIn ? new Date(`${date}T${checkIn}:00`) : null;
  const checkOutDate = checkOut ? new Date(`${date}T${checkOut}:00`) : null;
  const workHours = calcWorkHours(checkInDate, checkOutDate);

  const userWithShift = await db
    .select({ startTime: shiftsTable.startTime, lateThreshold: shiftsTable.lateThresholdMinutes })
    .from(usersTable)
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, Number(userId)))
    .limit(1);

  let lateMinutes = 0;
  if (checkInDate && userWithShift[0]?.startTime && status === "present") {
    lateMinutes = calcLateMinutes(checkInDate, userWithShift[0].startTime, date);
  }

  const existing = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.userId, Number(userId)), eq(attendanceTable.date, date)))
    .limit(1);

  const maxEdits = actorRole === "superadmin" ? 2 : 1;

  if (existing[0]) {
    const currentEdits = existing[0].editCount ?? 0;
    if (currentEdits >= maxEdits) {
      res.status(403).json({
        message: actorRole === "superadmin"
          ? "2 marta tahrir qilindi, qayta o'zgartirib bo'lmaydi"
          : "Davomat allaqachon belgilandi, o'zgartirib bo'lmaydi",
        locked: true,
      });
      return;
    }

    const [updated] = await db
      .update(attendanceTable)
      .set({
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status,
        note: note || null,
        lateMinutes,
        workHours,
        partialValue: status === "partial" ? (partialValue ?? null) : null,
        editCount: currentEdits + 1,
        updatedAt: new Date(),
      })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();

    res.json({ ...updated, locked: (updated.editCount ?? 0) >= maxEdits });
    return;
  }

  const [created] = await db
    .insert(attendanceTable)
    .values({
      userId: Number(userId),
      date,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status,
      note: note || null,
      lateMinutes,
      earlyLeaveMinutes: 0,
      workHours,
      partialValue: status === "partial" ? (partialValue ?? null) : null,
      editCount: 1,
    })
    .returning();

  res.json({ ...created, locked: actorRole !== "superadmin" });
});

// Update note only (always allowed)
router.patch("/note/:attendanceId", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.attendanceId);
  const { note } = req.body;

  await db
    .update(attendanceTable)
    .set({ note: note || null, updatedAt: new Date() })
    .where(eq(attendanceTable.id, id));

  const records = await getAttendanceRecords([eq(attendanceTable.id, id)]);
  res.json(records[0]);
});

// Get attendance range for history grid
router.get("/range", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const { startDate, endDate, departmentId } = req.query;

  if (!startDate || !endDate) {
    res.status(400).json({ message: "startDate va endDate kerak" });
    return;
  }

  const empWhere = departmentId
    ? eq(usersTable.departmentId, Number(departmentId))
    : undefined;

  const employees = await db
    .select({
      id: usersTable.id,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      departmentId: usersTable.departmentId,
      departmentName: departmentsTable.name,
      role: usersTable.role,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(empWhere)
    .orderBy(usersTable.firstName);

  const attConditions: SQL[] = [
    gte(attendanceTable.date, startDate as string),
    lte(attendanceTable.date, endDate as string),
  ];

  const records = await db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      date: attendanceTable.date,
      status: attendanceTable.status,
      checkIn: attendanceTable.checkIn,
      checkOut: attendanceTable.checkOut,
      workHours: attendanceTable.workHours,
      partialValue: attendanceTable.partialValue,
      note: attendanceTable.note,
      editCount: attendanceTable.editCount,
    })
    .from(attendanceTable)
    .where(and(...attConditions));

  res.json({ employees, records });
});

// List all attendance (for history page read-only)
router.get("/", async (req: AuthRequest, res: Response) => {
  const { userId, departmentId, date, startDate, endDate, status } = req.query;
  const conditions: SQL[] = [];

  if (date) conditions.push(eq(attendanceTable.date, date as string));
  if (startDate) conditions.push(gte(attendanceTable.date, startDate as string));
  if (endDate) conditions.push(lte(attendanceTable.date, endDate as string));
  if (userId) conditions.push(eq(attendanceTable.userId, Number(userId)));
  if (status) conditions.push(eq(attendanceTable.status, status as any));

  const records = await getAttendanceRecords(conditions);
  res.json(records);
});

router.delete("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.json({ message: "O'chirildi" });
});

export default router;
