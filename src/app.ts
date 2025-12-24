import "dotenv/config";
import express, { Application, Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";

import cors from "cors";
const app: Application = express();
const PORT = process.env.PORT || 3000;

const corsOptions = {
    origin: "http://localhost:3000",
    credentials: true
}
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.get('/api/v1/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', service: 'Ecommerce-Backend', timestamp: new Date().toISOString() });
});

interface HttpException extends Error {
    status?: number;
}

app.use((err: HttpException, req: Request, res: Response, next: NextFunction) => {
    const status = err.status || 500;
    const message = err.message || 'Something went wrong';
    if (process.env.NODE_ENV !== 'test') {
        console.error(`[Error] Status: ${status}, Message: ${message}, Stack: ${err.stack}`);
    }
    res.status(status).json({
        success: false,
        status: status,
        message: message,
    });
});


const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    // console.log(`Frontend URL: ${corsOptions.origin}`);
});

export default server;




