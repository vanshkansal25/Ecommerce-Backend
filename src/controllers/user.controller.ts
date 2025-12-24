import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { db } from '../db/db'
import { users } from "../db/schemas";
import { eq, or } from "drizzle-orm";


export function generateToken(user: { id: string; email: string }): string {
    const payload = {
        id: user.id,
        email: user.email,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
        expiresIn: "7d",
        algorithm: "HS256",
    });
}
export const registerUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { displayName, email, password } = req.body;
    if (!displayName || !email || !password) {
        return next(new ApiError(400, 'All fields are required'));
    }
    const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existingUser.length > 0) {
        return next(new ApiError(409, 'User already exists'));
    }
    const hashPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
        displayName,
        email,
        password: hashPassword,
    }).returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
    }
    )
    if (!newUser) {
        return next(new ApiError(500, 'Something went wrong while registering the user'));
    }
    const token = generateToken({ id: newUser.id, email: newUser.email });
    res.cookie("ecommerceToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return res.status(201).json(
        new ApiResponse(201, { newUser, token }, "User created Successfully")
    )

})

export const loginUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new ApiError(400, 'All fields are required'));
    }
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user.length) {
        return next(new ApiError(401, 'Invalid credentials or User Not Re'));
    }
    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
        return next(new ApiError(401, 'Invalid credentials'));
    }
    const token = generateToken({ id: user[0].id, email: user[0].email });
    res.cookie("ecommerceToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return res.status(200).json(
        new ApiResponse(200, {
            id: user[0].id,
            email: user[0].email,
            displayName: user[0].displayName,
            role: user[0].role,
        }, "User logged in Successfully")
    )
})
export const logoutUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    res.clearCookie("ecommerceToken",
        {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
        }
    );
    return res.status(200).json(
        new ApiResponse(200, {}, "User logged out Successfully")
    )
})
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
        return next(new ApiError(400, 'All fields are required'));
    }
    const userId = req.user!.id;
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user.length) {
        return next(new ApiError(404, 'User not found'));
    }
    const isPasswordValid = await bcrypt.compare(oldPassword, user[0].password);
    if (!isPasswordValid) {
        return next(new ApiError(401, 'Invalid credentials'));
    }
    const hashPassword = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ password: hashPassword }).where(eq(users.id, userId));
    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed Successfully")
    )
})
export const generateRefreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
