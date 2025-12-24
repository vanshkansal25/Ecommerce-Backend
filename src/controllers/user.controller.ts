import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { db } from '../db/db'
import { users } from "../db/schemas";
import { eq, or } from "drizzle-orm";

export const registerUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { displayName, email, password, role } = req.body;
    if (!displayName || !email || !password || !role) {
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
        role,
    }).returning({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role
    }
    )
    if (!newUser) {
        return next(new ApiError(500, 'Something went wrong while registering the user'));
    }
    return res.status(201).json(
        new ApiResponse(201, newUser, "User created Successfully")
    )

})

export const loginUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
export const logoutUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
export const changePassword = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
export const generateRefreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => { })
