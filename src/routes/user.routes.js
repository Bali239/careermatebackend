import express from "express";
import { createUser } from "../services/user.services.js";

const router = express.Router();

router.post("/register", createUser);

export default router;