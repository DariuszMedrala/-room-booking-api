const { buildReservationsHarness } = require("../helpers/reservationsHarness");

const NOW = new Date("2026-06-01T00:00:00.000Z");
const now = () => NOW;

const ROOMS = [
  { id: 1, name: "101", capacity: 10, buildingId: 1, buildingName: "Budynek A" },
  { id: 2, name: "102", capacity: 10, buildingId: 1, buildingName: "Budynek A" }
];
const USERS = [
  { id: 1, email: "admin@example.com" },
  { id: 2, email: "alice@example.com" },
  { id: 3, email: "bob@example.com" }
];
const ALICE = { id: 2, role: "USER" };
const BOB = { id: 3, role: "USER" };
const ADMIN = { id: 1, role: "ADMIN" };

const harness = (reservations = []) =>
  buildReservationsHarness({ rooms: ROOMS, users: USERS, reservations, now });

const existingSlot = {
  id: 1, roomId: 1, userId: 2, participants: 5,
  startTime: "2026-12-10T10:00:00.000Z", endTime: "2026-12-10T12:00:00.000Z",
  status: "CONFIRMED"
};

describe("reservations service - overlap rules", () => {
  test.each([
    ["nakładanie częściowe", 1, "2026-12-10T11:00:00.000Z", "2026-12-10T13:00:00.000Z", false],
    ["zawieranie się", 1, "2026-12-10T10:30:00.000Z", "2026-12-10T11:30:00.000Z", false],
    ["przedziały stykające się (dozwolone)", 1, "2026-12-10T12:00:00.000Z", "2026-12-10T14:00:00.000Z", true],
    ["inna sala (dozwolone)", 2, "2026-12-10T10:00:00.000Z", "2026-12-10T12:00:00.000Z", true]
  ])("%s", async (_name, roomId, startTime, endTime, allowed) => {
    const { service } = harness([existingSlot]);
    const attempt = service.createReservation(
      { roomId, participants: 5, startTime, endTime }, ALICE
    );
    if (allowed) {
      await expect(attempt).resolves.toMatchObject({ status: "CONFIRMED" });
    } else {
      await expect(attempt).rejects.toMatchObject({ code: "ROOM_ALREADY_BOOKED", statusCode: 409 });
    }
  });

  test("rezerwacja CANCELLED nie blokuje przedziału", async () => {
    const cancelled = { ...existingSlot, status: "CANCELLED", cancelledAt: "2026-05-01T00:00:00.000Z" };
    const { service } = harness([cancelled]);
    const attempt = service.createReservation(
      { roomId: 1, participants: 5, startTime: "2026-12-10T10:00:00.000Z", endTime: "2026-12-10T12:00:00.000Z" },
      ALICE
    );
    await expect(attempt).resolves.toMatchObject({ status: "CONFIRMED" });
  });
});

describe("reservations service - capacity", () => {
  test.each([
    ["participants == capacity (dozwolone)", 10, true],
    ["capacity + 1 (odrzucone)", 11, false]
  ])("%s", async (_name, participants, allowed) => {
    const { service } = harness();
    const attempt = service.createReservation(
      { roomId: 1, participants, startTime: "2026-12-20T10:00:00.000Z", endTime: "2026-12-20T11:00:00.000Z" },
      ALICE
    );
    if (allowed) {
      await expect(attempt).resolves.toMatchObject({ status: "CONFIRMED" });
    } else {
      await expect(attempt).rejects.toMatchObject({ code: "ROOM_CAPACITY_EXCEEDED", statusCode: 409 });
    }
  });
});

describe("reservations service - duration", () => {
  test.each([
    ["dokładnie 15 min (dozwolone)", "2026-12-20T10:15:00.000Z", true],
    ["dokładnie 8 h (dozwolone)", "2026-12-20T18:00:00.000Z", true],
    ["14 min (odrzucone)", "2026-12-20T10:14:00.000Z", false],
    ["8 h 1 min (odrzucone)", "2026-12-20T18:01:00.000Z", false]
  ])("%s", async (_name, endTime, allowed) => {
    const { service } = harness();
    const attempt = service.createReservation(
      { roomId: 1, participants: 5, startTime: "2026-12-20T10:00:00.000Z", endTime },
      ALICE
    );
    if (allowed) {
      await expect(attempt).resolves.toMatchObject({ status: "CONFIRMED" });
    } else {
      await expect(attempt).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
    }
  });
});

describe("reservations service - cancellation", () => {
  test("nie można anulować rozpoczętej rezerwacji", async () => {
    const started = {
      id: 1, roomId: 1, userId: 2, participants: 5,
      startTime: "2026-05-01T10:00:00.000Z", endTime: "2026-05-01T12:00:00.000Z",
      status: "CONFIRMED"
    };
    const { service } = harness([started]);
    await expect(service.cancelReservation(1, ALICE))
      .rejects.toMatchObject({ code: "RESERVATION_ALREADY_STARTED", statusCode: 409 });
  });

  test("podwójne anulowanie jest idempotentne (cancelledAt bez zmian)", async () => {
    const { service } = harness([existingSlot]);
    const first = await service.cancelReservation(1, ALICE);
    expect(first.status).toBe("CANCELLED");
    const second = await service.cancelReservation(1, ALICE);
    expect(second.status).toBe("CANCELLED");
    expect(second.cancelledAt).toBe(first.cancelledAt);
  });
});

describe("reservations service - ownership", () => {
  test("obcy USER nie może anulować cudzej rezerwacji (404)", async () => {
    const { service } = harness([existingSlot]);
    await expect(service.cancelReservation(1, BOB))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  test("ADMIN może anulować cudzą rezerwację", async () => {
    const { service } = harness([existingSlot]);
    await expect(service.cancelReservation(1, ADMIN))
      .resolves.toMatchObject({ status: "CANCELLED" });
  });

  test("obcy USER nie widzi cudzej rezerwacji (404)", async () => {
    const { service } = harness([existingSlot]);
    await expect(service.getReservation(1, BOB))
      .rejects.toMatchObject({ code: "NOT_FOUND", statusCode: 404 });
  });

  test("właściciel widzi swoją rezerwację", async () => {
    const { service } = harness([existingSlot]);
    await expect(service.getReservation(1, ALICE))
      .resolves.toMatchObject({ id: 1, user: { id: 2 } });
  });
});
