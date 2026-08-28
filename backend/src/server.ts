import express, { Application } from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "node:path";
import healthRouter from "./routes/health";
import patientsRouter from "./routes/patients";
import authRouter from "./routes/auth";
import appointmentsRouter from "./routes/appointments";
import medicalRecordsRouter from "./routes/medicalRecords";
import operationsRouter from "./routes/operations";
import adminRouter from "./routes/admin";
import { runMigrations } from "./db/migrate";
import { migrateLegacyPatients } from "./services/legacyMigration";
import { seedReferenceData } from "./services/referenceSeed";
import {
  attachCurrentUser,
  requireAuth,
  verifyRequestOrigin,
} from "./middleware/auth";
import { getAllowedOrigins } from "./config/origins";

dotenv.config();

const app: Application = express();
const port = process.env.PORT || 5000;
const allowedOrigins = getAllowedOrigins();

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);
app.use(verifyRequestOrigin);
app.use(attachCurrentUser);

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/patients", requireAuth, patientsRouter);
app.use("/api/appointments", requireAuth, appointmentsRouter);
app.use("/api/medical", requireAuth, medicalRecordsRouter);
app.use("/api/operations", requireAuth, operationsRouter);
app.use("/api/admin", requireAuth, adminRouter);

if (process.env.NODE_ENV === "production") {
  const frontendDirectory = path.resolve(__dirname, "../../frontend/dist");
  app.use(express.static(frontendDirectory, { index: false, maxAge: "1h" }));
  app.get("*", (_request, response) =>
    response.sendFile(path.join(frontendDirectory, "index.html")),
  );
}

app.use((_req, res) => {
  res.status(404).json({ message: "المسار المطلوب غير موجود." });
});

app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error("Unhandled request error:", error);
    res.status(500).json({ message: "حدث خطأ داخلي. يرجى المحاولة مرة أخرى." });
  },
);

async function startServer(): Promise<void> {
  await runMigrations();
  await migrateLegacyPatients();
  await seedReferenceData();
  app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Unable to start server:", error);
  process.exit(1);
});
