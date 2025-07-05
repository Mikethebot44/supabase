import { betterAuth } from "better-auth"

export const auth = betterAuth({
  database: {
    provider: "sqlite",
    url: "./auth.db", // Simple SQLite database for development
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false, // Disable for now - can enable later with proper email setup
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  secret: process.env.BETTER_AUTH_SECRET || "super-secret-key-change-in-production",
  baseURL: "http://localhost:8082",
})

export type Session = typeof auth.$Infer.Session
export type User = typeof auth.$Infer.User