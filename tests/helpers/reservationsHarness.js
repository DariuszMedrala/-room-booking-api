const { createReservationsService } = require("../../src/modules/reservations/reservations.service");

function buildReservationsHarness({ rooms = [], users = [], reservations = [], now, eventBus } = {}) {
  const roomsById = new Map(rooms.map(r => [r.id, r]));
  const usersById = new Map(users.map(u => [u.id, u]));
  const store = reservations.map(r => ({ ...r }));
  let nextId = store.reduce((max, r) => Math.max(max, r.id), 0) + 1;

  const toView = r => {
    const room = roomsById.get(r.roomId);
    const user = usersById.get(r.userId);
    return {
      id: r.id,
      room: room
        ? { id: room.id, name: room.name, building: { id: room.buildingId, name: room.buildingName } }
        : undefined,
      user: user ? { id: user.id, email: user.email } : { id: r.userId, email: `user${r.userId}@test.local` },
      participants: r.participants,
      startTime: r.startTime,
      endTime: r.endTime,
      status: r.status,
      cancelledAt: r.cancelledAt ?? null,
      createdAt: r.createdAt ?? "2026-01-01T00:00:00.000Z"
    };
  };

  const reservationsRepository = {
    async list(query = {}) {
      let items = store.map(toView).filter(v => {
        if (query.roomId && v.room.id !== query.roomId) return false;
        if (query.userId && v.user.id !== query.userId) return false;
        if (query.status && v.status !== query.status) return false;
        return true;
      });
      const total = items.length;
      if (query.limit) {
        const page = query.page || 1;
        items = items.slice((page - 1) * query.limit, (page - 1) * query.limit + query.limit);
      }
      return { items, total };
    },
    async findById(id) {
      const row = store.find(r => r.id === id);
      return row ? toView(row) : null;
    },
    async create(data) {
      const row = {
        id: nextId++,
        roomId: data.roomId,
        userId: data.userId,
        participants: data.participants,
        startTime: data.startTime,
        endTime: data.endTime,
        status: "CONFIRMED",
        cancelledAt: null,
        createdAt: "2026-01-01T00:00:00.000Z"
      };
      store.push(row);
      return toView(row);
    },
    async updateStatus(id, status) {
      const row = store.find(r => r.id === id);
      row.status = status;
      if (status === "CANCELLED") row.cancelledAt = "2026-03-03T00:00:00.000Z";
      return toView(row);
    }
  };

  const roomsRepository = {
    async findById(id) {
      return roomsById.get(id) || null;
    }
  };

  const events = [];
  const bus = eventBus || { publish: (type, payload) => events.push({ type, payload }) };

  const runInTransaction = fn => fn({ reservationsRepository, roomsRepository });
  const service = createReservationsService({ runInTransaction, now, eventBus: bus });

  return { service, reservationsRepository, roomsRepository, store, events, eventBus: bus };
}

module.exports = { buildReservationsHarness };
