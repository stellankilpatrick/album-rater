import jwt from "jsonwebtoken";

const DEFAULT_JWT_SECRET = "dev-secret";
const DEFAULT_JWT_EXPIRES_IN = "7d";

export function generateToken(user) {
  const secret = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || DEFAULT_JWT_EXPIRES_IN;

  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email
    },
    secret,
    { expiresIn }
  );
}