const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapi = require("./docs/openapi");
const requestLogger = require("./middleware/requestLogger");
const authenticate = require("./middleware/authenticate");
const authorize = require("./middleware/authorize");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const { createEventBus } = require("./events/eventBus");
const { registerListeners } = require("./events/listeners");

const { createBuildingsService } = require("./modules/buildings/buildings.service");
const { createBuildingsController } = require("./modules/buildings/buildings.controller");
const { createBuildingsRouter } = require("./modules/buildings/buildings.routes");

const { createRoomsService } = require("./modules/rooms/rooms.service");
const { createRoomsController } = require("./modules/rooms/rooms.controller");
const { createRoomsRouter } = require("./modules/rooms/rooms.routes");

const { createReservationsService } = require("./modules/reservations/reservations.service");
const { createReservationsController } = require("./modules/reservations/reservations.controller");
const { createReservationsRouter } = require("./modules/reservations/reservations.routes");

const { createAuthService } = require("./modules/auth/auth.service");
const { createAuthController } = require("./modules/auth/auth.controller");
const { createAuthRouter } = require("./modules/auth/auth.routes");

const { createAuditService } = require("./modules/audit/audit.service");
const { createAuditController } = require("./modules/audit/audit.controller");
const { createAuditRouter } = require("./modules/audit/audit.routes");

function createApp({ runInTransaction, buildingsRepository, roomsRepository, usersRepository, auditLogRepository }) {
  const app = express();
  app.use(requestLogger);
  app.use(express.json());

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));

  const eventBus = createEventBus();
  registerListeners(eventBus, { auditLogRepository, usersRepository });

  const authService = createAuthService({ usersRepository });
  app.use("/api/auth", createAuthRouter(createAuthController(authService)));

  const buildingsService = createBuildingsService({ buildingsRepository, roomsRepository });
  app.use("/api/buildings", authenticate, createBuildingsRouter(createBuildingsController(buildingsService)));

  const roomsService = createRoomsService({ roomsRepository, buildingsRepository });
  app.use("/api/rooms", authenticate, createRoomsRouter(createRoomsController(roomsService)));

  const reservationsService = createReservationsService({ runInTransaction, eventBus });
  app.use("/api/reservations", authenticate, createReservationsRouter(createReservationsController(reservationsService)));

  const auditService = createAuditService({ auditLogRepository });
  app.use("/api/admin/audit-log", authenticate, authorize("ADMIN"), createAuditRouter(createAuditController(auditService)));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };