"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
(0, node_test_1.default)("يسجل الطبيب ويحفظ الحساب وملف الطبيب للدخول لاحقاً", async () => {
    const databaseDirectory = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "clinic-auth-"));
    process.env.LOCAL_DATABASE_DIR = databaseDirectory;
    process.env.NODE_ENV = "test";
    process.chdir(node_path_1.default.resolve(__dirname, "../.."));
    const { db } = await Promise.resolve().then(() => __importStar(require("../db/client")));
    try {
        const { runMigrations } = await Promise.resolve().then(() => __importStar(require("../db/migrate")));
        const { authenticate, createInitialAdmin, registerDoctor } = await Promise.resolve().then(() => __importStar(require("./authService")));
        await runMigrations();
        await createInitialAdmin({
            fullName: "مدير الاختبار",
            email: "admin@test.local",
            password: "Admin-Test-Password-123!",
        });
        const registered = await registerDoctor({
            fullName: "د. طبيب الاختبار",
            email: "doctor@test.local",
            password: "Doctor-Test-Password-123!",
            specialty: "طب الأسرة",
            phone: "0790000000",
            licenseNumber: "TEST-123",
        });
        strict_1.default.equal(registered.email, "doctor@test.local");
        strict_1.default.equal(registered.roleCode, "DOCTOR");
        const loggedIn = await authenticate("DOCTOR@test.local", "Doctor-Test-Password-123!");
        strict_1.default.equal(loggedIn?.id, registered.id);
        const doctor = await db.query("SELECT full_name,specialty,phone,license_number FROM doctors WHERE user_id=$1", [registered.id]);
        strict_1.default.deepEqual(doctor.rows[0], {
            full_name: "د. طبيب الاختبار",
            specialty: "طب الأسرة",
            phone: "0790000000",
            license_number: "TEST-123",
        });
    }
    finally {
        await db.close();
        await (0, promises_1.rm)(databaseDirectory, { recursive: true, force: true });
    }
});
