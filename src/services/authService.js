import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import ApiError from "../utils/apiError.js";
import { getPool } from "../config/db.js";
import { newId } from "../db/index.js";

function signToken(userId) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return jwt.sign({ id: userId }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || "7d" });
}

async function register({ namaUsaha, email, password }) {
  const pool = getPool();
  const normalizedEmail = email.toLowerCase().trim();
  const existing = await pool.query(`SELECT id FROM users WHERE email=$1`, [normalizedEmail]);
  if (existing.rows[0]) throw new ApiError(409, "Email already registered");

  const hashed = await bcrypt.hash(password, 10);
  const userId = newId();
  const userRes = await pool.query(
    `INSERT INTO users (id, nama_usaha, email, password)
     VALUES ($1,$2,$3,$4)
     RETURNING id, nama_usaha as "namaUsaha", email`,
    [userId, namaUsaha, normalizedEmail, hashed]
  );
  const user = userRes.rows[0];

  const token = signToken(user.id);
  return { token, user: { id: user.id, namaUsaha: user.namaUsaha, email: user.email } };
}

async function login({ email, password }) {
  const pool = getPool();
  const normalizedEmail = email.toLowerCase().trim();
  const userRes = await pool.query(
    `SELECT id, nama_usaha as "namaUsaha", email, password FROM users WHERE email=$1`,
    [normalizedEmail]
  );
  const user = userRes.rows[0];
  if (!user) throw new ApiError(401, "Invalid credentials");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, "Invalid credentials");

  const token = signToken(user.id);
  return { token, user: { id: user.id, namaUsaha: user.namaUsaha, email: user.email } };
}

async function me(userId) {
  const pool = getPool();
  const userRes = await pool.query(
    `SELECT id, nama_usaha as "namaUsaha", email, created_at as "createdAt" FROM users WHERE id=$1`,
    [userId]
  );
  const user = userRes.rows[0];
  if (!user) throw new ApiError(404, "User not found");
  return { id: user.id, namaUsaha: user.namaUsaha, email: user.email, createdAt: user.createdAt };
}

export { register, login, me };
