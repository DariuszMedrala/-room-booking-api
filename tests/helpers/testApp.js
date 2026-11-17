const db = require("../../src/db/knex");
const { createApp } = require("../../src/app");
const { createBuildingsRepository } = require("../../src/modules/buildings/buildings.repository.knex");
const { createRoomsRepository } = require("../../src/modules/rooms/rooms.repository.knex");
const { createReservationsRepository } = require("../../src/modules/reservations/reservations.repository.knex");
const { createUsersRepository } = require("../../src/modules/auth/auth.repository.knex");
const { createAuditLogRepository } = require("../../src/modules/audit/audit.repository.knex");

function createTestApp() {
  const runInTransaction = fn => db.transaction(trx => fn({
    buildingsRepository: createBuildingsRepository(trx),
    roomsRepository: createRoomsRepository(trx),
    reservationsRepository: createReservationsRepository(trx),
    usersRepository: createUsersRepository(trx)
  }));

  const repositories = {
    runInTransaction,
    buildingsRepository: createBuildingsRepository(db),
    roomsRepository: createRoomsRepository(db),
    usersRepository: createUsersRepository(db),
    auditLogRepository: createAuditLogRepository(db)
  };

  return createApp(repositories);
}

module.exports = { createTestApp, db };
