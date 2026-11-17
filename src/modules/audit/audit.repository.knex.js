function createAuditLogRepository(db) {
  return {
    async create(eventType, payload) {
      await db("audit_log").insert({ event_type: eventType, payload: JSON.stringify(payload) });
    },
    async list({ eventType, page = 1, limit = 20 }) {
      const base = db("audit_log").modify(qb => {
        if (eventType) qb.where("event_type", eventType);
      });

      const [rows, { count }] = await Promise.all([
        base.clone().select("*").orderBy("id", "desc").limit(limit).offset((page - 1) * limit),
        base.clone().count({ count: "*" }).first()
      ]);

      return { items: rows, total: Number(count) };
    }
  };
}

module.exports = { createAuditLogRepository };
