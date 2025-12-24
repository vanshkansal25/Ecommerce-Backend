class ApiError extends Error {
    statusCode: number;
    data: any;
    success: boolean;
    errors: any[];

    constructor(
        statusCode: number,
        message: string = "Something Went Wrong",
        errors: any[] = [],        // array of errors
        stack: string = ""         // this represents error stack if any
    ) {
        super(message);
        this.statusCode = statusCode;
        this.data = null;
        this.success = false;
        this.errors = errors;

        if (stack) {
            this.stack = stack;
        } else {
            // Capture the stack trace in Node.js environment
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export { ApiError };
