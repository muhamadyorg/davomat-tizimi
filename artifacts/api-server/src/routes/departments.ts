import { Router, type IRouter, type Response } from "express";
import { db, departmentsTable, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

async function getDeptWithStats(id?: number) {
  const allDepts = await db.select().from(departmentsTable);

  const filtered = id !== undefined ? allDepts.filter((d) => d.id === id) : allDepts;

  return Promise.all(
    filtered.map(async (dept) => {
      let managerName: string | null = null;
      if (dept.managerId) {
        const mgr = await db
          .select({ firstName: usersTable.firstName, lastName: usersTable.lastName })
          .from(usersTable)
          .where(eq(usersTable.id, dept.managerId))
          .limit(1);
        if (mgr[0]) {
          managerName = `${mgr[0].firstName} ${mgr[0].lastName}`;
        }
      }

      const empCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(usersTable)
        .where(eq(usersTable.departmentId, dept.id));

      return {
        id: dept.id,
        name: dept.name,
        description: dept.description,
        managerId: dept.managerId,
        managerName,
        employeeCount: Number(empCount[0]?.count || 0),
        createdAt: dept.createdAt,
      };
    })
  );
}

router.get("/", async (_req: AuthRequest, res: Response) => {
  const depts = await getDeptWithStats();
  res.json(depts);
});

router.post("/", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const { name, description, managerId } = req.body;

  if (!name) {
    res.status(400).json({ message: "Name required" });
    return;
  }

  const [dept] = await db
    .insert(departmentsTable)
    .values({ name, description: description || null, managerId: managerId || null })
    .returning();

  const full = await getDeptWithStats(dept.id);
  res.status(201).json(full[0]);
});

router.put("/:id", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { name, description, managerId } = req.body;

  await db
    .update(departmentsTable)
    .set({ name, description: description || null, managerId: managerId || null, updatedAt: new Date() })
    .where(eq(departmentsTable.id, id));

  const full = await getDeptWithStats(id);
  res.json(full[0]);
});

router.delete("/:id", requireRole("superadmin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  await db.delete(departmentsTable).where(eq(departmentsTable.id, id));
  res.json({ message: "Department deleted" });
});

export default router;
