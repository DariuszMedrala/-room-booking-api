function createAuditService({ auditLogRepository }) {
  return {
    async listAuditLog(query) {
      const { items, total } = await auditLogRepository.list(query);
      return {
        items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
      };
    }
  };
}

module.exports = { createAuditService };
