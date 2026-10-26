import "dotenv/config";
import { envSchema } from "../schemas/env.schema.js";

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map(({ path, message }) => `${path.join(".")}: ${message}`)
    .join("\n");
  throw new Error(`Invalid server environment configuration:\n${details}`);
}

export const env = Object.freeze(parsedEnv.data);
