import { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { asyncHandler } from "../utils/asyncHandler";
import { ApiError } from "../utils/apiError";
import { ApiResponse } from "../utils/apiResponse";
import { db } from '../db/db'
import { addresses, users } from "../db/schemas";
import { eq, or } from "drizzle-orm";
import { refreshTokens } from "../db/schemas";


export function generateAccessToken(user: { id: string; email: string; role: string }): string {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
    };

    return jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET!, {
        expiresIn: process.env.ACCESS_TOKEN_EXPIRY as any,
        algorithm: "HS256",
    });
}
export function generateRefreshToken(user: { id: string; email: string; role: string }): string {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
    };

    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET!, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY as any,
        algorithm: "HS256",
    });
}
export const registerUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { displayName, email, password, address } = req.body;
    if (!displayName || !email || !password) {
        return next(new ApiError(400, 'All fields are required'));
    }
    const result = await db.transaction(async (tx) => {
        const existingUser = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (existingUser.length > 0) {
            return next(new ApiError(409, 'User already exists'));
        }
        const hashPassword = await bcrypt.hash(password, 10);
        const [newUser] = await tx.insert(users).values({
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
        await tx.insert(addresses).values({
            userId: newUser.id,
            ...address,
        }).onConflictDoUpdate({
            target: addresses.userId, // The unique constraint column
            set: {
                address_line1: address.address_line1,
                address_line2: address.address_line2,
                city: address.city,
                state: address.state,
                country: address.country,
                pincode: address.pincode,
                phone: address.phone,
                updatedAt: new Date(),
            },
        })
        return newUser;
    })
    if (!result) {
        return next(new ApiError(500, 'Something went wrong while registering the user'));
    }
    const accesstoken = generateAccessToken({ id: result.id, email: result.email, role: result.role });
    res.cookie("ecommerceaccessToken", accesstoken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
    return res.status(201).json(
        new ApiResponse(201, { result, accesstoken }, "User created Successfully")
    )

})

export const loginUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return next(new ApiError(400, 'All fields are required'));
    }
    const user = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user.length) {
        throw new ApiError(401, 'Invalid credentials or User Not Registered');
    }
    const isPasswordValid = await bcrypt.compare(password, user[0].password);
    if (!isPasswordValid) {
        return next(new ApiError(401, 'Invalid credentials'));
    }
    const accessToken = generateAccessToken({ id: user[0].id, email: user[0].email, role: user[0].role });
    const refreshToken = generateRefreshToken({ id: user[0].id, email: user[0].email, role: user[0].role });
    const tokenHash = await bcrypt.hash(refreshToken, 10);
    await db.insert(refreshTokens).values({
        userId: user[0].id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    res.cookie("ecommerceaccessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 15 * 60 * 1000,
    });
    res.cookie("ecommercerefreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(200).json(
        new ApiResponse(200, {
            id: user[0].id,
            email: user[0].email,
            displayName: user[0].displayName,
            role: user[0].role,
            accessToken,
            refreshToken,
        }, "User logged in Successfully")
    )
})
export const logoutUser = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const refreshToken = req.cookies.refreshToken;
    // Revoke in DB so it can't be used again
    if (refreshToken) {
        const decoded = jwt.decode(refreshToken) as any;
        await db.update(refreshTokens)
            .set({ isRevoked: true })
            .where(eq(refreshTokens.userId, decoded.id));
    }
    res.clearCookie("ecommerceaccessToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
    });
    res.clearCookie("ecommercerefreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "none",
    });

    return res.status(200).json(new ApiResponse(200, {}, "Logged out"));
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
export const generateRefreshTokenFromAccess = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const incomingRefreshToken = req.cookies.ecommercerefreshToken;
    if (!incomingRefreshToken) {
        return next(new ApiError(401, 'Unauthorized Access'));
    }
    try {
        const decoded = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET!);
        if (!decoded || typeof decoded === "string") {
            return next(new ApiError(401, 'Unauthorized Access'));
        }
        const userToken = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, decoded.id)).limit(1);
        const activeToken = userToken.find(t => !t.isRevoked && bcrypt.compareSync(incomingRefreshToken, t.tokenHash));
        if (!activeToken) {
            return next(new ApiError(403, 'Invalid or expired session'));
        }
        await db.delete(refreshTokens).where(eq(refreshTokens.id, activeToken.id));
        const newAccessToken = generateAccessToken({ id: decoded.id, email: decoded.email, role: decoded.role });
        const newRefreshToken = generateRefreshToken({ id: decoded.id, email: decoded.email, role: decoded.role });
        const newTokenHash = await bcrypt.hash(newRefreshToken, 10);

        await db.insert(refreshTokens).values({
            userId: decoded.id,
            tokenHash: newTokenHash,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        })
        res.cookie("ecommerceToken", newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "none",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        })
        return res.status(200).json(
            new ApiResponse(200, {}, "Refresh token generated Successfully")
        )
    } catch (error) {
        throw new ApiError(401, "Inavlid refresh Token")
    }
})
