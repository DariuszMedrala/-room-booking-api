const EVENT_TYPES = ["reservation.created", "reservation.cancelled"];

function registerListeners(eventBus, { auditLogRepository, usersRepository }) {
  for (const type of EVENT_TYPES) {
    eventBus.subscribe(type, payload => auditLogRepository.create(type, payload));
  }

  eventBus.subscribe("reservation.cancelled", async payload => {
    if (payload.cancelledBy === payload.userId) return;
    const owner = await usersRepository.findById(payload.userId);
    if (owner) {
      console.log(`[notification] to: ${owner.email} - rezerwacja #${payload.reservationId} zostala anulowana przez administratora`);
    }
  });
}

module.exports = { registerListeners };
