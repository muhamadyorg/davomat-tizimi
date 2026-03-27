import { Router, type IRouter, type Response } from "express";
import { db, shiftsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/", async (_req: AuthRequest, res: Response) => {
  const shifts = await db.select().from(shiftsTable).orderBy(shiftsTable.name);
  const result = shifts.map((s) => ({
    ...s,
    workDays: s.workDays.split(",").map(Number),
  }));
  res.json(result);
});

router.post("/", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const { name, startTime, endTime, lateThresholdMinutes, workDays } = req.body;
  if (!name || !startTime || !endTime) {
    res.status(400).json({ message: "Required fields missing" });
    return;
  }

  const [shift] = await db
    .insert(shiftsTable)
    .values({
      name,
      startTime,
      endTime,
      lateThresholdMinutes: lateThresholdMinutes ?? 15,
      workDays: Array.isArray(workDays) ? workDays.join(",") : workDays,
    })
    .returning();

  res.status(201).json({ ...shift, workDays: shift.workDays.split(",").map(Number) });
});

router.put("/:id", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, startTime, endTime, lateThresholdMinutes, workDays } = req.body;

  await db
    .update(shiftsTable)
    .set({
      name,
      startTime,
      endTime,
      lateThresholdMinutes,
      workDays: Array.isArray(workDays) ? workDays.join(",") : workDays,
      updatedAt: new Date(),
    })
    .where(eq(shiftsTable.id, id));

  const [shift] = await db.select().from(shiftsTable).where(eq(shiftsTable.id, id)).limit(1);
  res.json({ ...shift, workDays: shift.workDays.split(",").map(Number) });
});

router.delete("/:id", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(shiftsTable).where(eq(shiftsTable.id, id));
  res.json({ message: "Shift deleted" });
});

export default router;
