import type { NextFunction, Request, Response } from "express";
import { getSessionUser } from "../services/authService";
import { getAllowedOrigins } from "../config/origins";

export async function attachCurrentUser(
  request: Request,
  _response: Response,
  next: NextFunction,
): Promise<void> {
  try {
    request.currentUser = (await getSessionUser(request)) ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
}

export function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (!request.currentUser) {
    response.status(401).json({ message: "يجب تسجيل الدخول للمتابعة." });
    return;
  }
  next();
}

export function requirePermission(permission: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (!request.currentUser) {
      response.status(401).json({ message: "يجب تسجيل الدخول للمتابعة." });
      return;
    }
    if (!request.currentUser.permissions.includes(permission)) {
      response
        .status(403)
        .json({ message: "ليست لديك صلاحية لتنفيذ هذه العملية." });
      return;
    }
    next();
  };
}

export function verifyRequestOrigin(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    next();
    return;
  }
  const origin = request.get("origin");
  const allowed = getAllowedOrigins();
  const requestOrigin = `${request.protocol}://${request.get("host")}`;
  if (origin && !allowed.includes(origin) && origin !== requestOrigin) {
    response.status(403).json({ message: "مصدر الطلب غير مسموح." });
    return;
  }
  next();
}
