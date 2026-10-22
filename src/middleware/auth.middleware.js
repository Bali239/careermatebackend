import {SuccessResponse, ErrorResponse} from "../utils/Responses.js";
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return ErrorResponse(401, res, null, "Authorization header missing");
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
        return ErrorResponse(401, res, null, "Token missing");
    }

    // Here you would typically verify the token using a library like jsonwebtoken
    // For example:
    // jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    //     if (err) {
    //         return res.status(403).json({ message: "Invalid token" });
    //     }
    //     req.user = user;
    //     next();
    // });

    next(); // Call next() to pass control to the next middleware or route handler
};

export default authMiddleware;