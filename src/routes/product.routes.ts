import { Router } from "express";
import { createProduct, deleteProduct, getProducts, updateProduct } from "../controllers/product.controller";
import { authMiddleware, authorize } from "../middlewares/auth.middleware";

const productRouter = Router();

productRouter.get("/get-products", getProducts);
productRouter.post("/create-product", authMiddleware, authorize('ADMIN'), createProduct);
productRouter.put("/update-product/:productId", authMiddleware, authorize('ADMIN'), updateProduct);
productRouter.delete("/delete-product/:productId", authMiddleware, authorize('ADMIN'), deleteProduct);

export default productRouter;