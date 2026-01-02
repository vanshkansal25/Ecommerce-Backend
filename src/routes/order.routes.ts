import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { getUserOrders } from "../controllers/order.controllers";



const orderRouter = Router();


orderRouter.get("/my-orders", authMiddleware, getUserOrders)
orderRouter.get("/my-orders/:orderId", authMiddleware, getUserOrders)


export default orderRouter;