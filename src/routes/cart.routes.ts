import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { addCart, getCart, removeFromCart, updateCartQuantity } from "../controllers/cart.controller";

const cartRouter = Router();


cartRouter.post("/add-cart", authMiddleware, addCart);
cartRouter.patch("/update-cart", authMiddleware, updateCartQuantity);
cartRouter.delete("/remove-from-cart/:variantId", authMiddleware, removeFromCart);
cartRouter.get("/get-cart", authMiddleware, getCart);


export default cartRouter;
