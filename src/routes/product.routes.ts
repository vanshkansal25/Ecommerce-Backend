import { Router } from "express";
import { createProduct, deleteProduct, updateProduct } from "../controllers/product.controller";
import { authMiddleware, authorize } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.post("/create-product", authMiddleware, authorize('ADMIN'), createProduct);
productRouter.put("/update-product/:productId", authMiddleware, authorize('ADMIN'), updateProduct);
productRouter.delete("/delete-product/:productId", authMiddleware, authorize('ADMIN'), deleteProduct);

export default productRouter;