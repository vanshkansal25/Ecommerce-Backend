import { Router } from "express";
import { authMiddleware, authorize } from "../middlewares/auth.middleware";
import { getSalesStats } from "../controllers/sales.controller";


const salesRouter = Router();
salesRouter.get('/analytics', authMiddleware, authorize("ADMIN"), getSalesStats)
export default salesRouter;