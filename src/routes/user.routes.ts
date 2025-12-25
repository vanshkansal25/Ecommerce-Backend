import { Router } from "express";
import { changePassword, generateRefreshTokenFromAccess, loginUser, logoutUser, registerUser } from "../controllers/user.controller";
import { authMiddleware } from "../middlewares/auth.middleware";

const authRouter = Router();
// Public Routes
authRouter.post('/register', registerUser);
authRouter.post('/login', loginUser);

// Protected Routes
authRouter.post('/logout', authMiddleware, logoutUser);
authRouter.post('/refresh-token', authMiddleware, generateRefreshTokenFromAccess);
authRouter.post('/change-password', authMiddleware, changePassword);
export default authRouter;