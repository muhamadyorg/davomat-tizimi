import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import departmentsRouter from "./departments";
import shiftsRouter from "./shifts";
import attendanceRouter from "./attendance";
import leaveRouter from "./leave";
import reportsRouter from "./reports";
import seedRouter from "./seed";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/departments", departmentsRouter);
router.use("/shifts", shiftsRouter);
router.use("/attendance", attendanceRouter);
router.use("/leave", leaveRouter);
router.use("/reports", reportsRouter);
router.use("/stats", reportsRouter);
router.use(seedRouter);

export default router;
