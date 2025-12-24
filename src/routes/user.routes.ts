import { Router } from "express";
import { changePassword } from "src/controllers/user.controller";
import { authMiddleware } from "src/middlewares/auth.middleware";

const authRouter = Router();


authRouter.post('change-password', authMiddleware, changePassword)