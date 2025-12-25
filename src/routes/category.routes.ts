import { Router } from "express";
import {
    createCategory,
    getCategoryBySlug,
    getCategoryTree,
    updateCategory
} from "src/controllers/category.controller";
import { authMiddleware, authorize } from "src/middlewares/auth.middleware";

const categoriesRouter = Router();

// Public Routes
categoriesRouter.get('/tree', getCategoryTree);
categoriesRouter.get('/slug/:slug', getCategoryBySlug);

// Admin Only Routes
categoriesRouter.post('/', authMiddleware, authorize("ADMIN"), createCategory);
categoriesRouter.put('/:id', authMiddleware, authorize("ADMIN"), updateCategory);

export default categoriesRouter;