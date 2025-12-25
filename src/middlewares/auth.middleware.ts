import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/apiError";
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
        const token = req.cookies["ecommerceaccessToken"];
        if (!token) {
            throw new ApiError(401, "Unauthorized Access");
        }

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET!) as any;
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };

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

export const authorize = (...allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // req.user was populated by authMiddleware
        if (!req.user) {
            return next(new ApiError(401, "Authentication required"));
        }

        if (!allowedRoles.includes(req.user.role)) {
            return next(new ApiError(403, `Access Denied: ${req.user.role} role unauthorized`));
        }

        next(); // Authorization successful
    };
};