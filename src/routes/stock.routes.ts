import { Router } from "express";
import { addStock, getStockLevel, syncReservedStock, updateStock } from "../controllers/stock.controller";
import { authMiddleware, authorize } from "src/middlewares/auth.middleware";



const stockRouter = Router();


stockRouter.post("/add-stock", authMiddleware, authorize('ADMIN'), addStock);
stockRouter.post("/update-stock", authMiddleware, updateStock);
stockRouter.post("/sync-reserved-stock", authMiddleware, syncReservedStock);
stockRouter.get("/get-stock-level/:variantId", getStockLevel);



export default stockRouter;




