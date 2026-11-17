function toAuditLogResponse(row) {
  return {
    id: row.id,
    eventType: row.event_type,
    payload: row.payload,
    createdAt: new Date(row.created_at).toISOString()
  };
}

module.exports = { toAuditLogResponse };
