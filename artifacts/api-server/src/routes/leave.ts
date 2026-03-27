import { Router, type IRouter, type Response } from "express";
import { db, leaveRequestsTable, usersTable } from "@workspace/db";
import { eq, and, gte, lte, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

async function getLeaveRecords(conditions: SQL[]) {
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const reviewer = usersTable;

  const records = await db
    .select({
      id: leaveRequestsTable.id,
      userId: leaveRequestsTable.userId,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
      leaveType: leaveRequestsTable.leaveType,
      startDate: leaveRequestsTable.startDate,
      endDate: leaveRequestsTable.endDate,
      days: leaveRequestsTable.days,
      reason: leaveRequestsTable.reason,
      status: leaveRequestsTable.status,
      reviewedById: leaveRequestsTable.reviewedById,
      reviewNote: leaveRequestsTable.reviewNote,
      createdAt: leaveRequestsTable.createdAt,
    })
    .from(leaveRequestsTable)
    .leftJoin(usersTable, eq(leaveRequestsTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(leaveRequestsTable.createdAt);

  return records.map((r) => ({
    ...r,
    userFullName: `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim(),
    reviewedByName: null,
  }));
}

function calcDays(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  const diff = Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1;
  return Math.max(1, diff);
}

router.get("/", async (req: AuthRequest, res: Response) => {
  const { userId, status, startDate, endDate } = req.query;
  const conditions: SQL[] = [];

  if (req.user!.role === "employee") {
    conditions.push(eq(leaveRequestsTable.userId, req.user!.id));
  } else if (userId) {
    conditions.push(eq(leaveRequestsTable.userId, Number(userId)));
  }

  if (status) conditions.push(eq(leaveRequestsTable.status, status as "pending" | "approved" | "rejected"));
  if (startDate) conditions.push(gte(leaveRequestsTable.startDate, startDate as string));
  if (endDate) conditions.push(lte(leaveRequestsTable.endDate, endDate as string));

  const records = await getLeaveRecords(conditions);
  res.json(records);
});

router.post("/", async (req: AuthRequest, res: Response) => {
  const { leaveType, startDate, endDate, reason } = req.body;

  if (!leaveType || !startDate || !endDate || !reason) {
    res.status(400).json({ message: "All fields required" });
    return;
  }

  const days = calcDays(startDate, endDate);

  const [created] = await db
    .insert(leaveRequestsTable)
    .values({
      userId: req.user!.id,
      leaveType,
      startDate,
      endDate,
      days,
      reason,
      status: "pending",
    })
    .returning();

  const records = await getLeaveRecords([eq(leaveRequestsTable.id, created.id)]);
  res.status(201).json(records[0]);
});

router.put("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { status, reviewNote } = req.body;

  if (!status || !["approved", "rejected"].includes(status)) {
    res.status(400).json({ message: "Valid status required" });
    return;
  }

  await db
    .update(leaveRequestsTable)
    .set({
      status,
      reviewedById: req.user!.id,
      reviewNote: reviewNote || null,
      updatedAt: new Date(),
    })
    .where(eq(leaveRequestsTable.id, id));

  const records = await getLeaveRecords([eq(leaveRequestsTable.id, id)]);
  res.json(records[0]);
});

router.delete("/:id", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);

  const existing = await db.select().from(leaveRequestsTable).where(eq(leaveRequestsTable.id, id)).limit(1);
  if (!existing[0]) {
    res.status(404).json({ message: "Not found" });
    return;
  }

  if (req.user!.role === "employee" && existing[0].userId !== req.user!.id) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  await db.delete(leaveRequestsTable).where(eq(leaveRequestsTable.id, id));
  res.json({ message: "Leave request deleted" });
});

export default router;
