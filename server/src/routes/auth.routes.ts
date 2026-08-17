import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { audit } from "../lib/audit.js";
import { unauthorized } from "../lib/errors.js";
import { env, isProd } from "../env.js";
import {
  issueRefreshToken,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  signAccessToken,
  verifyPassword,
} from "../lib/tokens.js";

export const authRouter = Router();

const REFRESH_COOKIE = "mc_nexus_rt";

const cookieOpts = {
  httpOnly: true as const,
  sameSite: "lax" as const,
  secure: isProd,
  domain: env.COOKIE_DOMAIN,
  path: "/api/auth",
  maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
};

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many login attempts. Try again shortly." } },
});

const publicUser = (u: { id: string; email: string; name: string; role: string; title: string | null; avatarColor: string }) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  title: u.title,
  avatarColor: u.avatarColor,
});

authRouter.post(
  "/login",
  loginLimiter,
  validate(z.object({ email: z.string().email(), password: z.string().min(1) })),
  async (req, res, next) => {
    try {
      const { email, password } = req.body as { email: string; password: string };
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
        return next(unauthorized("Invalid email or password"));
      }

      const { token } = await issueRefreshToken(user.id, { ip: req.ip, userAgent: req.get("user-agent") ?? undefined });
      await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

      req.user = { sub: user.id, email: user.email, role: user.role };
      audit(req, "auth.login", "User", user.id);

      res.cookie(REFRESH_COOKIE, token, cookieOpts);
      res.json({
        user: publicUser(user),
        accessToken: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
      });
    } catch (err) {
      next(err);
    }
  }
);

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) return next(unauthorized("No refresh token"));

    const rotated = await rotateRefreshToken(presented, { ip: req.ip, userAgent: req.get("user-agent") ?? undefined });
    if (!rotated) {
      res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
      return next(unauthorized("Refresh token is invalid or expired"));
    }

    res.cookie(REFRESH_COOKIE, rotated.token, cookieOpts);
    res.json({
      user: publicUser(rotated.user),
      accessToken: signAccessToken({ sub: rotated.user.id, email: rotated.user.email, role: rotated.user.role }),
    });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (presented) await revokeRefreshToken(presented);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout-all", requireAuth, async (req, res, next) => {
  try {
    await revokeAllForUser(req.user!.sub);
    audit(req, "auth.logout_all", "User", req.user!.sub);
    res.clearCookie(REFRESH_COOKIE, { ...cookieOpts, maxAge: undefined });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
    if (!user || !user.isActive) return next(unauthorized());
    res.json({ user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});
