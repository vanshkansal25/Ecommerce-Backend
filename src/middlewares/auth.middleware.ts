import { NextFunction, Request, Response } from "express";
import { ApiError } from "src/utils/apiError";
import jwt from "jsonwebtoken";
import { db } from "../db/db";
import "express";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                email: string;
                role: string;
            };
        }
    }
}


export const authMiddleware = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const token = req.cookies["ecommerceToken"];
        if (!token) {
            throw new ApiError(401, "Unauthorized Access");
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!);
        if (!decoded || typeof decoded === "string") {
            throw new ApiError(401, "Unauthorized Access");
        }

        const { id, email } = decoded as jwt.JwtPayload;
        const user = await db.query.users.findFirst({
            where: (users, { eq }) => eq(users.email, email),
            columns: {
                //Only return these fields.
                id: true,
                email: true,
                role: true,
            },
        });

        if (!user) {
            throw new ApiError(401, "Unauthorized Access");
        }

        req.user = user;
        next();
    } catch (error: any) {
        if (error instanceof jwt.TokenExpiredError) {
            throw new Error(error.message);
        } else if (error instanceof jwt.JsonWebTokenError) {
            throw new Error(error.message);
        } else {
            throw new Error(error.message);
        }
    }
};