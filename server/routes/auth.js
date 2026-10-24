import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();
export const JWT_SECRET = process.env.JWT_SECRET || "waterwallet_super_secret_jwt_key_2026";

// In-memory user database
export const users = new Map();
let nextUserId = 3;

// Pre-seed demo users
users.set(1, {
  id: 1,
  email: "shirurnidhish2005@gmail.com",
  hashed_password: bcrypt.hashSync("password123", 10),
  created_at: new Date().toISOString(),
});

users.set(2, {
  id: 2,
  email: "demo@waterwallet.org",
  hashed_password: bcrypt.hashSync("waterwallet123", 10),
  created_at: new Date().toISOString(),
});

// Middleware to authenticate Bearer token
export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ detail: "Not authenticated" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded.sub);
    const user = users.get(userId);
    if (!user) {
      return res.status(401).json({ detail: "User not found" });
    }
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid or expired token" });
  }
}

// Middleware for routes that allow guest / anonymous access with fallback
export function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = Number(decoded.sub);
      const user = users.get(userId);
      if (user) {
        req.user = user;
        return next();
      }
    } catch {
      // Fall through to guest user on expired/invalid token
    }
  }
  req.user = { id: 1, email: "guest@waterwallet.local", isGuest: true };
  next();
}

// POST /api/auth/register
router.post("/register", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  for (const user of users.values()) {
    if (user.email.toLowerCase() === email.toLowerCase()) {
      return res.status(400).json({
        detail: "The user with this email already exists in the system.",
      });
    }
  }

  const newUser = {
    id: nextUserId++,
    email,
    hashed_password: bcrypt.hashSync(password, 10),
    created_at: new Date().toISOString(),
  };
  users.set(newUser.id, newUser);

  return res.status(201).json({
    id: newUser.id,
    email: newUser.email,
    created_at: newUser.created_at,
  });
});

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ detail: "Email and password are required" });
  }

  let foundUser = null;
  for (const user of users.values()) {
    if (user.email.toLowerCase() === email.toLowerCase()) {
      foundUser = user;
      break;
    }
  }

  if (!foundUser || !bcrypt.compareSync(password, foundUser.hashed_password)) {
    return res.status(401).json({ detail: "Incorrect email or password" });
  }

  const token = jwt.sign({ sub: String(foundUser.id) }, JWT_SECRET, {
    expiresIn: "7d",
  });

  return res.json({
    access_token: token,
    token_type: "bearer",
  });
});

// GET /api/auth/me
router.get("/me", authenticateToken, (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    created_at: req.user.created_at,
  });
});

export default router;
