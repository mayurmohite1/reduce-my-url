import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1).max(200),
});

export const createLinkSchema = z.object({
  targetUrl: z.string().url().max(4096),
  code: z
    .string()
    .min(4)
    .max(32)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
  title: z.string().max(200).optional(),
});

