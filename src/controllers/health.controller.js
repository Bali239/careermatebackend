import { env } from "../config/env.js";

export const getHealth = (req, res) => {
	res.status(200).json({
		status: "ok",
		service: "ai-career-assistant-api",
		environment: env.NODE_ENV,
		timestamp: new Date().toISOString(),
	});
};
