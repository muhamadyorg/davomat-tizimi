import { Router, type IRouter, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, departmentsTable, shiftsTable } from "@workspace/db";
import { eq, and, ilike, SQL } from "drizzle-orm";
import { requireAuth, requireRole, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

router.use(requireAuth);

router.get("/", async (req: AuthRequest, res: Response) => {
  const { role, departmentId, isActive, search } = req.query;

  const conditions: SQL[] = [];

  if (role) {
    conditions.push(eq(usersTable.role, role as "superadmin" | "admin" | "employee"));
  }
  if (departmentId) {
    conditions.push(eq(usersTable.departmentId, Number(departmentId)));
  }
  if (isActive !== undefined) {
    conditions.push(eq(usersTable.isActive, isActive === "true"));
  }
  if (search) {
    conditions.push(ilike(usersTable.firstName, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const users = await db
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
      shiftName: shiftsTable.name,
      position: usersTable.position,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(whereClause);

  res.json(users);
});

router.get("/:id", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const rows = await db
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
      shiftName: shiftsTable.name,
      position: usersTable.position,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!rows[0]) {
    res.status(404).json({ message: "User not found" });
    return;
  }
  res.json(rows[0]);
});

router.post("/", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const { username, password, firstName, lastName, email, phone, role, departmentId, shiftId, position, isActive } = req.body;

  if (!username || !password || !firstName || !lastName || !role) {
    res.status(400).json({ message: "Required fields missing" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
  if (existing[0]) {
    res.status(400).json({ message: "Username already taken" });
    return;
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [user] = await db
    .insert(usersTable)
    .values({
      username,
      password: hashedPassword,
      firstName,
      lastName,
      email: email || null,
      phone: phone || null,
      role: role as "superadmin" | "admin" | "employee",
      departmentId: departmentId || null,
      shiftId: shiftId || null,
      position: position || null,
      isActive: isActive !== false,
    })
    .returning();

  const fullUser = await db
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
      shiftName: shiftsTable.name,
      position: usersTable.position,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, user.id))
    .limit(1);

  res.status(201).json(fullUser[0]);
});

router.put("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { username, firstName, lastName, email, phone, role, departmentId, shiftId, position, isActive } = req.body;

  const updateData: Partial<typeof usersTable.$inferInsert> = {};
  if (username !== undefined) updateData.username = username;
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (email !== undefined) updateData.email = email;
  if (phone !== undefined) updateData.phone = phone;
  if (role !== undefined) updateData.role = role;
  if (departmentId !== undefined) updateData.departmentId = departmentId;
  if (shiftId !== undefined) updateData.shiftId = shiftId;
  if (position !== undefined) updateData.position = position;
  if (isActive !== undefined) updateData.isActive = isActive;
  updateData.updatedAt = new Date();

  await db.update(usersTable).set(updateData).where(eq(usersTable.id, id));

  const updated = await db
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
      shiftName: shiftsTable.name,
      position: usersTable.position,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .leftJoin(departmentsTable, eq(usersTable.departmentId, departmentsTable.id))
    .leftJoin(shiftsTable, eq(usersTable.shiftId, shiftsTable.id))
    .where(eq(usersTable.id, id))
    .limit(1);

  res.json(updated[0]);
});

router.delete("/:id", requireRole("superadmin", "admin"), async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  if (id === req.user!.id) {
    res.status(400).json({ message: "Cannot delete yourself" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.json({ message: "User deleted" });
});

router.put("/:id/password", async (req: AuthRequest, res: Response) => {
  const id = Number(req.params.id);
  const { newPassword, currentPassword } = req.body;

  if (!newPassword) {
    res.status(400).json({ message: "New password required" });
    return;
  }

  const isSelf = req.user!.id === id;
  const isAdmin = req.user!.role === "superadmin" || req.user!.role === "admin";

  if (!isSelf && !isAdmin) {
    res.status(403).json({ message: "Forbidden" });
    return;
  }

  if (isSelf && !isAdmin) {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    const valid = await bcrypt.compare(currentPassword || "", users[0]?.password || "");
    if (!valid) {
      res.status(401).json({ message: "Current password is incorrect" });
      return;
    }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.update(usersTable).set({ password: hashedPassword, updatedAt: new Date() }).where(eq(usersTable.id, id));
  res.json({ message: "Password changed successfully" });
});

export default router;
