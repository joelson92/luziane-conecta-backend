export class AppError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
    }
}
export const asyncHandler = (fn) => (req, res, next) => {
    fn(req, res, next).catch(next);
};
