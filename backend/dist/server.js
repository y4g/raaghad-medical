"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const node_path_1 = __importDefault(require("node:path"));
const health_1 = __importDefault(require("./routes/health"));
const patients_1 = __importDefault(require("./routes/patients"));
const auth_1 = __importDefault(require("./routes/auth"));
const appointments_1 = __importDefault(require("./routes/appointments"));
const medicalRecords_1 = __importDefault(require("./routes/medicalRecords"));
const operations_1 = __importDefault(require("./routes/operations"));
const admin_1 = __importDefault(require("./routes/admin"));
const migrate_1 = require("./db/migrate");
const legacyMigration_1 = require("./services/legacyMigration");
const referenceSeed_1 = require("./services/referenceSeed");
const auth_2 = require("./middleware/auth");
const origins_1 = require("./config/origins");
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
const allowedOrigins = (0, origins_1.getAllowedOrigins)();
app.disable("x-powered-by");
if (process.env.NODE_ENV === "production")
    app.set("trust proxy", 1);
app.use((0, helmet_1.default)({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use((0, cors_1.default)({ origin: allowedOrigins, credentials: true }));
app.use(express_1.default.json({ limit: "100kb" }));
app.use(express_1.default.urlencoded({ extended: true, limit: "100kb" }));
app.use((0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
}));
app.use(auth_2.verifyRequestOrigin);
app.use(auth_2.attachCurrentUser);
app.use("/api/health", health_1.default);
app.use("/api/auth", auth_1.default);
app.use("/api/patients", auth_2.requireAuth, patients_1.default);
app.use("/api/appointments", auth_2.requireAuth, appointments_1.default);
app.use("/api/medical", auth_2.requireAuth, medicalRecords_1.default);
app.use("/api/operations", auth_2.requireAuth, operations_1.default);
app.use("/api/admin", auth_2.requireAuth, admin_1.default);
if (process.env.NODE_ENV === "production") {
    const frontendDirectory = node_path_1.default.resolve(__dirname, "../../frontend/dist");
    app.use(express_1.default.static(frontendDirectory, { index: false, maxAge: "1h" }));
    app.get("*", (_request, response) => response.sendFile(node_path_1.default.join(frontendDirectory, "index.html")));
}
app.use((_req, res) => {
    res.status(404).json({ message: "المسار المطلوب غير موجود." });
});
app.use((error, _req, res, _next) => {
    console.error("Unhandled request error:", error);
    res.status(500).json({ message: "حدث خطأ داخلي. يرجى المحاولة مرة أخرى." });
});
async function startServer() {
    await (0, migrate_1.runMigrations)();
    await (0, legacyMigration_1.migrateLegacyPatients)();
    await (0, referenceSeed_1.seedReferenceData)();
    app.listen(port, () => {
        console.log(`Server is running on http://localhost:${port}`);
    });
}
startServer().catch((error) => {
    console.error("Unable to start server:", error);
    process.exit(1);
});
