import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

test("يسجل الطبيب ويحفظ الحساب وملف الطبيب للدخول لاحقاً", async () => {
  const databaseDirectory = await mkdtemp(path.join(tmpdir(), "clinic-auth-"));
  process.env.LOCAL_DATABASE_DIR = databaseDirectory;
  process.env.NODE_ENV = "test";
  process.chdir(path.resolve(__dirname, "../.."));

  const { db } = await import("../db/client");
  try {
    const { runMigrations } = await import("../db/migrate");
    const { authenticate, createInitialAdmin, registerDoctor } =
      await import("./authService");
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
    assert.equal(registered.email, "doctor@test.local");
    assert.equal(registered.roleCode, "DOCTOR");

    const loggedIn = await authenticate(
      "DOCTOR@test.local",
      "Doctor-Test-Password-123!",
    );
    assert.equal(loggedIn?.id, registered.id);

    const doctor = await db.query<{
      full_name: string;
      specialty: string;
      phone: string;
      license_number: string;
    }>(
      "SELECT full_name,specialty,phone,license_number FROM doctors WHERE user_id=$1",
      [registered.id],
    );
    assert.deepEqual(doctor.rows[0], {
      full_name: "د. طبيب الاختبار",
      specialty: "طب الأسرة",
      phone: "0790000000",
      license_number: "TEST-123",
    });
  } finally {
    await db.close();
    await rm(databaseDirectory, { recursive: true, force: true });
  }
});
