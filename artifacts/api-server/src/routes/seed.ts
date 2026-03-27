import { Router, type IRouter, type Response, type Request } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, departmentsTable, shiftsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/seed", async (_req: Request, res: Response) => {
  try {
    const existingSuperadmin = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, "superadmin"))
      .limit(1);

    if (existingSuperadmin[0]) {
      res.json({ message: "Already seeded" });
      return;
    }

    const [dept1] = await db.insert(departmentsTable).values({ name: "IT Bo'lim", description: "Axborot texnologiyalari" }).returning();
    const [dept2] = await db.insert(departmentsTable).values({ name: "Moliya Bo'lim", description: "Moliya va buxgalteriya" }).returning();
    const [dept3] = await db.insert(departmentsTable).values({ name: "HR Bo'lim", description: "Kadrlar bo'limi" }).returning();

    const [shift1] = await db.insert(shiftsTable).values({
      name: "Asosiy Smena",
      startTime: "09:00",
      endTime: "18:00",
      lateThresholdMinutes: 15,
      workDays: "1,2,3,4,5",
    }).returning();

    const [shift2] = await db.insert(shiftsTable).values({
      name: "Ertalabki Smena",
      startTime: "08:00",
      endTime: "16:00",
      lateThresholdMinutes: 10,
      workDays: "1,2,3,4,5",
    }).returning();

    const superAdminPass = await bcrypt.hash("superadmin123", 10);
    const adminPass = await bcrypt.hash("admin123", 10);
    const empPass = await bcrypt.hash("emp123", 10);

    await db.insert(usersTable).values([
      {
        username: "superadmin",
        password: superAdminPass,
        firstName: "Super",
        lastName: "Admin",
        email: "superadmin@davomat.uz",
        phone: "+998901234567",
        role: "superadmin",
        position: "Bosh Administrator",
        isActive: true,
      },
      {
        username: "admin",
        password: adminPass,
        firstName: "Abdulloh",
        lastName: "Karimov",
        email: "admin@davomat.uz",
        phone: "+998901234568",
        role: "admin",
        departmentId: dept1.id,
        shiftId: shift1.id,
        position: "IT Menejer",
        isActive: true,
      },
      {
        username: "alisher",
        password: empPass,
        firstName: "Alisher",
        lastName: "Nazarov",
        email: "alisher@davomat.uz",
        phone: "+998901234569",
        role: "employee",
        departmentId: dept1.id,
        shiftId: shift1.id,
        position: "Dasturchi",
        isActive: true,
      },
      {
        username: "zulfiya",
        password: empPass,
        firstName: "Zulfiya",
        lastName: "Ergasheva",
        email: "zulfiya@davomat.uz",
        phone: "+998901234570",
        role: "employee",
        departmentId: dept2.id,
        shiftId: shift2.id,
        position: "Buxgalter",
        isActive: true,
      },
      {
        username: "bobur",
        password: empPass,
        firstName: "Bobur",
        lastName: "Toshmatov",
        email: "bobur@davomat.uz",
        phone: "+998901234571",
        role: "employee",
        departmentId: dept3.id,
        shiftId: shift1.id,
        position: "HR Mutaxassis",
        isActive: true,
      },
    ]);

    res.json({
      message: "Ma'lumotlar muvaffaqiyatli yaratildi!",
      credentials: [
        { role: "superadmin", username: "superadmin", password: "superadmin123" },
        { role: "admin", username: "admin", password: "admin123" },
        { role: "employee", username: "alisher", password: "emp123" },
        { role: "employee", username: "zulfiya", password: "emp123" },
        { role: "employee", username: "bobur", password: "emp123" },
      ],
    });
  } catch (err) {
    res.status(500).json({ message: String(err) });
  }
});

export default router;
