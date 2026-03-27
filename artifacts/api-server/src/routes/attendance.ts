import { Router, type IRouter, type Response } from "express";
import { db, attendanceTable, usersTable, departmentsTable, shiftsTable } from "@workspace/db";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

function buildAttendanceQuery(conditions: SQL[]) {
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  return db
    .select({
      id: attendanceTable.id,
      userId: attendanceTable.userId,
      userFullName: db.$with("u").fields.firstName,
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
    .where(whereClause)
    .orderBy(attendanceTable.date);
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
      createdAt: attendanceTable.createdAt,
    })
    .from(attendanceTable)
    .leftJoin(usersTable, eq(attendanceTable.userId, usersTable.id))
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .where(whereClause)
    .orderBy(attendanceTable.date);

  return records.map((r) => ({
    ...r,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
  }));
}

function calcWorkHours(checkIn: Date | null, checkOut: Date | null): number {
  if (!checkIn || !checkOut) return 0;
  return Math.round(((checkOut.getTime() - checkIn.getTime()) / 3600000) * 100) / 100;
}

function calcLateMinutes(checkIn: Date | null, shiftStart: string, date: string): number {
  if (!checkIn) return 0;
  const [h, m] = shiftStart.split(":").map(Number);
  const expected = new Date(`${date}T${shiftStart}:00`);
  const diff = Math.floor((checkIn.getTime() - expected.getTime()) / 60000);
  return Math.max(0, diff);
}

function calcEarlyLeave(checkOut: Date | null, shiftEnd: string, date: string): number {
  if (!checkOut) return 0;
  const expected = new Date(`${date}T${shiftEnd}:00`);
  const diff = Math.floor((expected.getTime() - checkOut.getTime()) / 60000);
  return Math.max(0, diff);
}

router.get("/today", async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const conditions: SQL[] = [
    eq(attendanceTable.userId, req.user!.id),
    eq(attendanceTable.date, today),
  ];

  const records = await getAttendanceRecords(conditions);
  const record = records[0] || null;

  res.json({
    record,
    checkedIn: !!record?.checkIn,
    checkedOut: !!record?.checkOut,
    checkInTime: record?.checkIn ? new Date(record.checkIn).toLocaleTimeString() : null,
    checkOutTime: record?.checkOut ? new Date(record.checkOut).toLocaleTimeString() : null,
  });
});

router.post("/checkin", async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const { note } = req.body;

  const existing = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.userId, req.user!.id), eq(attendanceTable.date, today)))
    .limit(1);

  if (existing[0]?.checkIn) {
    res.status(400).json({ message: "Already checked in today" });
    return;
  }

  const userWithShift = await db
    .select({ shiftId: usersTable.shiftId, startTime: shiftsTable.startTime, lateThreshold: shiftsTable.lateThresholdMinutes })
    .from(usersTable)
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  let lateMinutes = 0;
  let status: "present" | "late" = "present";

  if (userWithShift[0]?.startTime) {
    lateMinutes = calcLateMinutes(now, userWithShift[0].startTime, today);
    const threshold = userWithShift[0].lateThreshold ?? 15;
    if (lateMinutes > threshold) {
      status = "late";
    }
  }

  let record;
  if (existing[0]) {
    const [updated] = await db
      .update(attendanceTable)
      .set({ checkIn: now, status, lateMinutes, updatedAt: new Date() })
      .where(eq(attendanceTable.id, existing[0].id))
      .returning();
    record = updated;
  } else {
    const [created] = await db
      .insert(attendanceTable)
      .values({
        userId: req.user!.id,
        date: today,
        checkIn: now,
        status,
        lateMinutes,
        earlyLeaveMinutes: 0,
        workHours: 0,
        note: note || null,
      })
      .returning();
    record = created;
  }

  const records = await getAttendanceRecords([eq(attendanceTable.id, record.id)]);
  res.json(records[0]);
});

router.post("/checkout", async (req: AuthRequest, res: Response) => {
  const today = new Date().toISOString().split("T")[0];
  const now = new Date();
  const { note } = req.body;

  const existing = await db
    .select()
    .from(attendanceTable)
    .where(and(eq(attendanceTable.userId, req.user!.id), eq(attendanceTable.date, today)))
    .limit(1);

  if (!existing[0]?.checkIn) {
    res.status(400).json({ message: "Must check in first" });
    return;
  }

  if (existing[0]?.checkOut) {
    res.status(400).json({ message: "Already checked out today" });
    return;
  }

  const userWithShift = await db
    .select({ endTime: shiftsTable.endTime })
    .from(usersTable)
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  let earlyLeaveMinutes = 0;
  if (userWithShift[0]?.endTime) {
    earlyLeaveMinutes = calcEarlyLeave(now, userWithShift[0].endTime, today);
  }

  const workHours = calcWorkHours(existing[0].checkIn, now);
  const status = earlyLeaveMinutes > 30 ? "early_leave" : existing[0].status;

  const [updated] = await db
    .update(attendanceTable)
    .set({ checkOut: now, earlyLeaveMinutes, workHours, status, note: note || existing[0].note, updatedAt: new Date() })
    .where(eq(attendanceTable.id, existing[0].id))
    .returning();

  const records = await getAttendanceRecords([eq(attendanceTable.id, updated.id)]);
  res.json(records[0]);
});

router.get("/", async (req: AuthRequest, res: Response) => {
  const { userId, departmentId, date, startDate, endDate, status } = req.query;
  const conditions: SQL[] = [];

  if (req.user!.role === "employee") {
    conditions.push(eq(attendanceTable.userId, req.user!.id));
  } else if (userId) {
    conditions.push(eq(attendanceTable.userId, Number(userId)));
  }

  if (date) conditions.push(eq(attendanceTable.date, date as string));
  if (startDate) conditions.push(gte(attendanceTable.date, startDate as string));
  if (endDate) conditions.push(lte(attendanceTable.date, endDate as string));
  if (status) conditions.push(eq(attendanceTable.status, status as "present" | "absent" | "late" | "early_leave" | "on_leave"));

  const records = await getAttendanceRecords(conditions);
  res.json(records);
});

router.post("/", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const { userId, date, checkIn, checkOut, status, note } = req.body;

  if (!userId || !date || !status) {
    res.status(400).json({ message: "Required fields missing" });
    return;
  }

  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  const workHours = calcWorkHours(checkInDate, checkOutDate);

  const [created] = await db
    .insert(attendanceTable)
    .values({
      userId: Number(userId),
      date,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      workHours,
      note: note || null,
    })
    .returning();

  const records = await getAttendanceRecords([eq(attendanceTable.id, created.id)]);
  res.status(201).json(records[0]);
});

router.put("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { checkIn, checkOut, status, note } = req.body;

  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  const workHours = calcWorkHours(checkInDate, checkOutDate);

  await db
    .update(attendanceTable)
    .set({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      status,
      workHours,
      note: note || null,
      updatedAt: new Date(),
    })
    .where(eq(attendanceTable.id, id));

  const records = await getAttendanceRecords([eq(attendanceTable.id, id)]);
  res.json(records[0]);
});

router.delete("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
  res.json({ message: "Attendance record deleted" });
});

export default router;
