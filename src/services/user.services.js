import User from "../models/user.model.js";
import { userSchema } from "../schemas/user.schema.js";
import {SuccessResponse} from "../utils/Responses.js";
import AppError from "../utils/Error.js";

export const createUser = async (req, res, next) => {
    try {
        const parsedData = userSchema.safeParse(req.body);

        if (!parsedData.success) {
            const message = parsedData.error.issues?.[0]?.message || "Validation failed";
            return next(new AppError(message, 400));
        }

        const user = await User.create(parsedData.data);
        return SuccessResponse(201, res, user, "User created successfully");
        
    } catch (error) {
        return next(error);
    }
};

