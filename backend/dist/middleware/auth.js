"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachCurrentUser = attachCurrentUser;
exports.requireAuth = requireAuth;
exports.requirePermission = requirePermission;
exports.verifyRequestOrigin = verifyRequestOrigin;
const authService_1 = require("../services/authService");
const origins_1 = require("../config/origins");
async function attachCurrentUser(request, _response, next) {
    try {
        request.currentUser = (await (0, authService_1.getSessionUser)(request)) ?? undefined;
        next();
    }
    catch (error) {
        next(error);
    }
}
function requireAuth(request, response, next) {
    if (!request.currentUser) {
        response.status(401).json({ message: "يجب تسجيل الدخول للمتابعة." });
        return;
    }
    next();
}
function requirePermission(permission) {
    return (request, response, next) => {
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
function verifyRequestOrigin(request, response, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
        next();
        return;
    }
    const origin = request.get("origin");
    const allowed = (0, origins_1.getAllowedOrigins)();
    const requestOrigin = `${request.protocol}://${request.get("host")}`;
    if (origin && !allowed.includes(origin) && origin !== requestOrigin) {
        response.status(403).json({ message: "مصدر الطلب غير مسموح." });
        return;
    }
    next();
}
