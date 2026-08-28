"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllowedOrigins = getAllowedOrigins;
const LOCAL_DEVELOPMENT_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
];
function getAllowedOrigins() {
    const configuredOrigins = (process.env.CLIENT_ORIGIN ?? "")
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean);
    const developmentOrigins = process.env.NODE_ENV === "production" ? [] : LOCAL_DEVELOPMENT_ORIGINS;
    const hostingOrigins = [process.env.RENDER_EXTERNAL_URL]
        .map((origin) => origin?.trim().replace(/\/$/, ""))
        .filter((origin) => Boolean(origin));
    return [
        ...new Set([
            ...configuredOrigins,
            ...developmentOrigins,
            ...hostingOrigins,
        ]),
    ];
}
