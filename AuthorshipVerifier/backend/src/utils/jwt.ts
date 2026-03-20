import jwt from "jsonwebtoken";
import { env } from "../config/env";

export type JwtPayload = {
  userId: string;
  email: string;
};

export const signToken = (payload: JwtPayload): string => {
  const expiresIn = env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"];

  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn
  });
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
};
