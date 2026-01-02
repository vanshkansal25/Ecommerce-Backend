import { Router } from "express"
import { confirmOrderPayment, createPaymentIntent, intialCheckOut } from "../controllers/checkout.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { checkoutLimiter } from "src/middlewares/rate-limiter.middleware";



const checkOutRouter = Router();

checkOutRouter.post("/", authMiddleware, intialCheckOut);
checkOutRouter.post("/create-payment-intent", authMiddleware, checkoutLimiter, createPaymentIntent);
checkOutRouter.post("/confirm-payment", authMiddleware, confirmOrderPayment);


export default checkOutRouter;


