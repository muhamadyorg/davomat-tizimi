import { type Request, type Response, type NextFunction } from "express";
import { getUserById } from "../routes/auth";

export interface AuthRequest extends Request {
  user?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    role: "superadmin" | "admin" | "employee";
    departmentId: number | null;
    isActive: boolean;
  };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const user = await getUserById(req.session.userId);
  if (!user || !user.isActive) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  req.user = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    departmentId: user.departmentId ?? null,
    isActive: user.isActive,
  };
  next();
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ message: "Forbidden" });
      return;
    }
    next();
  };
}
