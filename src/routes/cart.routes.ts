import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware";
import { addCart, getCart } from "../controllers/cart.controller";

const cartRouter = Router();


cartRouter.post("/add-cart", authMiddleware, addCart);
cartRouter.get("/get-cart", authMiddleware, getCart);


export default cartRouter;
