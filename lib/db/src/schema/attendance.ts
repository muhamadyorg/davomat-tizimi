import { pgTable, serial, integer, text, timestamp, date, pgEnum, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "absent", "late", "early_leave", "on_leave"]);

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  date: date("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  status: attendanceStatusEnum("status").notNull().default("absent"),
  lateMinutes: integer("late_minutes").notNull().default(0),
  earlyLeaveMinutes: integer("early_leave_minutes").notNull().default(0),
  workHours: real("work_hours").notNull().default(0),
  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
