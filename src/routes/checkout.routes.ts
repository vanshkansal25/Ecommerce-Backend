import { Router } from "express"
import { intialCheckOut } from "../controllers/checkout.controller";



const checkOutRouter = Router();

checkOutRouter.post("/", intialCheckOut);


export default checkOutRouter;


