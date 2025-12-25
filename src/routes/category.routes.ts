import { Router } from "express";
import {
    createCategory,
    getCategoryBySlug,
    getCategoryTree,
    updateCategory
} from "../controllers/category.controller";
import { authMiddleware, authorize } from "../middlewares/auth.middleware";

const categoriesRouter = Router();

// Public Routes
categoriesRouter.get('/tree', getCategoryTree);
categoriesRouter.get('/slug/:slug', getCategoryBySlug);

// Admin Only Routes
categoriesRouter.post('/create-category', authMiddleware, authorize('ADMIN'), createCategory);
categoriesRouter.put('/update-category/:id', authMiddleware, authorize('ADMIN'), updateCategory);

export default categoriesRouter;
