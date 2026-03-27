import { Router, type IRouter, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, departmentsTable, shiftsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

declare module "express-session" {
  interface SessionData {
    userId: number;
  }
}

export async function getUserById(id: number) {
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
  return rows[0] || null;
}

router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({ message: "Username and password required" });
    return;
  }

  const users = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username))
    .limit(1);

  const user = users[0];

  if (!user) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ message: "Account is deactivated" });
    return;
  }

  const isValid = await bcrypt.compare(password, user.password);
  if (!isValid) {
    res.status(401).json({ message: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;

  const userInfo = await getUserById(user.id);
  res.json({ user: userInfo, message: "Login successful" });
});

router.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ message: "Logout failed" });
      return;
    }
    res.json({ message: "Logged out successfully" });
  });
});

router.get("/me", async (req: Request, res: Response) => {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const user = await getUserById(req.session.userId);
  if (!user) {
    res.status(401).json({ message: "User not found" });
    return;
  }
  res.json(user);
});

export default router;
