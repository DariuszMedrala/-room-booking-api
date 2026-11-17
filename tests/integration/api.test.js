const request = require("supertest");
const bcrypt = require("bcryptjs");
const { createTestApp, db } = require("../helpers/testApp");
const { ensureTestDatabase, resetDatabase } = require("../helpers/testDb");

const app = createTestApp();

const register = (email, password) =>
  request(app).post("/api/auth/register").send({ email, password });

const login = async (email, password) => {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken;
};

const seedAdmin = async () => {
  const [row] = await db("users")
    .insert({ email: "admin@test.local", password_hash: await bcrypt.hash("admin-pass-123", 10), role: "ADMIN" })
    .returning("id");
  return row.id;
};

const seedRoom = async (capacity = 10) => {
  const [b] = await db("buildings").insert({ name: "Budynek T", address: "ul. Testowa 1" }).returning("id");
  const [r] = await db("rooms").insert({ building_id: b.id, name: "101", capacity }).returning("id");
  return { buildingId: b.id, roomId: r.id };
};

const reservationBody = (roomId, startTime, endTime, participants = 4) =>
  ({ roomId, participants, startTime, endTime });

beforeAll(async () => {
  await ensureTestDatabase();
  await db.migrate.latest();
});

beforeEach(async () => {
  await resetDatabase(db);
});

afterAll(async () => {
  await new Promise(resolve => setTimeout(resolve, 150));
  await db.destroy();
});

test("rejestracja + logowanie + GET /api/auth/me", async () => {
  const reg = await register("alice@example.com", "bardzo-dlugie-haslo");
  expect(reg.status).toBe(201);
  expect(reg.body).toMatchObject({ email: "alice@example.com", role: "USER" });

  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  expect(token).toBeDefined();

  const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  expect(me.status).toBe(200);
  expect(me.body).toMatchObject({ email: "alice@example.com", role: "USER" });
  expect(me.body.password_hash).toBeUndefined();
});

test("POST /api/reservations -> 201, nagłówek Location i rekord w bazie", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  const { roomId } = await seedRoom();

  const res = await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${token}`)
    .send(reservationBody(roomId, "2027-01-10T10:00:00.000Z", "2027-01-10T11:00:00.000Z"));

  expect(res.status).toBe(201);
  expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);

  const row = await db("reservations").where({ id: res.body.id }).first();
  expect(row).toBeTruthy();
  expect(row.room_id).toBe(roomId);
});

test("400 z poprawnymi details dla błędnego body", async () => {
  const res = await register("bad@example.com", "short");
  expect(res.status).toBe(400);
  expect(res.body.error.code).toBe("VALIDATION_ERROR");
  expect(Array.isArray(res.body.error.details)).toBe(true);
  expect(res.body.error.details[0]).toMatchObject({ location: "body", field: "password" });
});

test("401 bez tokenu", async () => {
  const res = await request(app).get("/api/reservations");
  expect(res.status).toBe(401);
  expect(res.body.error.code).toBe("UNAUTHORIZED");
});

test("403 dla USER próbującego utworzyć salę", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  const { buildingId } = await seedRoom();

  const res = await request(app)
    .post("/api/rooms")
    .set("Authorization", `Bearer ${token}`)
    .send({ buildingId, name: "999", capacity: 5 });

  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe("FORBIDDEN");
});

test("404 dla USER pobierającego cudzą rezerwację", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const aliceToken = await login("alice@example.com", "bardzo-dlugie-haslo");
  const { roomId } = await seedRoom();

  const created = await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${aliceToken}`)
    .send(reservationBody(roomId, "2027-01-10T10:00:00.000Z", "2027-01-10T11:00:00.000Z"));

  await register("bob@example.com", "bardzo-dlugie-haslo");
  const bobToken = await login("bob@example.com", "bardzo-dlugie-haslo");

  const res = await request(app)
    .get(`/api/reservations/${created.body.id}`)
    .set("Authorization", `Bearer ${bobToken}`);

  expect(res.status).toBe(404);
  expect(res.body.error.code).toBe("NOT_FOUND");
});

test("409 ROOM_ALREADY_BOOKED dla nakładającej się rezerwacji", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  const { roomId } = await seedRoom();

  await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${token}`)
    .send(reservationBody(roomId, "2027-01-10T10:00:00.000Z", "2027-01-10T12:00:00.000Z"));

  const res = await request(app)
    .post("/api/reservations")
    .set("Authorization", `Bearer ${token}`)
    .send(reservationBody(roomId, "2027-01-10T11:00:00.000Z", "2027-01-10T13:00:00.000Z"));

  expect(res.status).toBe(409);
  expect(res.body.error.code).toBe("ROOM_ALREADY_BOOKED");
});

test("GET /api/admin/audit-log bez tokenu -> 401", async () => {
  const res = await request(app).get("/api/admin/audit-log");
  expect(res.status).toBe(401);
});

test("GET /api/admin/audit-log dla USER -> 403", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  const res = await request(app).get("/api/admin/audit-log").set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(403);
});

test("GET /api/admin/audit-log dla ADMIN -> 200 z paginacją", async () => {
  await seedAdmin();
  const token = await login("admin@test.local", "admin-pass-123");
  const res = await request(app).get("/api/admin/audit-log").set("Authorization", `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.data)).toBe(true);
  expect(res.body.meta).toHaveProperty("total");
});

test("pagination: meta.total i liczba elementów w data dla limit < liczba rekordów", async () => {
  await register("alice@example.com", "bardzo-dlugie-haslo");
  const token = await login("alice@example.com", "bardzo-dlugie-haslo");
  const { roomId } = await seedRoom();

  for (const day of ["10", "11", "12"]) {
    await request(app)
      .post("/api/reservations")
      .set("Authorization", `Bearer ${token}`)
      .send(reservationBody(roomId, `2027-01-${day}T10:00:00.000Z`, `2027-01-${day}T11:00:00.000Z`));
  }

  const res = await request(app)
    .get("/api/reservations?limit=2")
    .set("Authorization", `Bearer ${token}`);

  expect(res.status).toBe(200);
  expect(res.body.meta.total).toBe(3);
  expect(res.body.data).toHaveLength(2);
});
