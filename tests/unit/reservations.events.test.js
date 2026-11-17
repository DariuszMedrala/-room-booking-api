const { buildReservationsHarness } = require("../helpers/reservationsHarness");

const now = () => new Date("2026-06-01T00:00:00.000Z");

const ROOMS = [{ id: 1, name: "101", capacity: 10, buildingId: 1, buildingName: "Budynek A" }];
const USERS = [
  { id: 1, email: "admin@example.com" },
  { id: 2, email: "alice@example.com" },
  { id: 3, email: "bob@example.com" }
];
const ALICE = { id: 2, role: "USER" };
const BOB = { id: 3, role: "USER" };

const existingSlot = {
  id: 1, roomId: 1, userId: 2, participants: 5,
  startTime: "2026-12-10T10:00:00.000Z", endTime: "2026-12-10T12:00:00.000Z",
  status: "CONFIRMED"
};

const futureBody = {
  roomId: 1, participants: 5,
  startTime: "2026-12-20T10:00:00.000Z", endTime: "2026-12-20T11:00:00.000Z"
};

test("publikuje reservation.created po udanym utworzeniu", async () => {
  const publish = jest.fn();
  const { service } = buildReservationsHarness({ rooms: ROOMS, users: USERS, now, eventBus: { publish } });

  const reservation = await service.createReservation(futureBody, ALICE);

  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledWith("reservation.created", expect.objectContaining({
    reservationId: reservation.id,
    roomId: 1,
    userId: 2
  }));
});

test("nie publikuje eventu gdy utworzenie kończy się błędem (kolizja 409)", async () => {
  const publish = jest.fn();
  const { service } = buildReservationsHarness({ rooms: ROOMS, users: USERS, reservations: [existingSlot], now, eventBus: { publish } });

  await expect(service.createReservation(
    { roomId: 1, participants: 5, startTime: "2026-12-10T11:00:00.000Z", endTime: "2026-12-10T13:00:00.000Z" },
    ALICE
  )).rejects.toMatchObject({ code: "ROOM_ALREADY_BOOKED" });

  expect(publish).not.toHaveBeenCalled();
});

test("publikuje reservation.cancelled po udanym anulowaniu", async () => {
  const publish = jest.fn();
  const { service } = buildReservationsHarness({ rooms: ROOMS, users: USERS, reservations: [existingSlot], now, eventBus: { publish } });

  await service.cancelReservation(1, ALICE);

  expect(publish).toHaveBeenCalledTimes(1);
  expect(publish).toHaveBeenCalledWith("reservation.cancelled", expect.objectContaining({
    reservationId: 1,
    userId: 2,
    cancelledBy: 2
  }));
});

test("idempotentne ponowne anulowanie nie publikuje eventu", async () => {
  const publish = jest.fn();
  const { service } = buildReservationsHarness({ rooms: ROOMS, users: USERS, reservations: [existingSlot], now, eventBus: { publish } });

  await service.cancelReservation(1, ALICE);
  publish.mockClear();

  await service.cancelReservation(1, ALICE);

  expect(publish).not.toHaveBeenCalled();
});

test("nie publikuje eventu gdy obcy USER próbuje anulować (404)", async () => {
  const publish = jest.fn();
  const { service } = buildReservationsHarness({ rooms: ROOMS, users: USERS, reservations: [existingSlot], now, eventBus: { publish } });

  await expect(service.cancelReservation(1, BOB)).rejects.toMatchObject({ code: "NOT_FOUND" });

  expect(publish).not.toHaveBeenCalled();
});
