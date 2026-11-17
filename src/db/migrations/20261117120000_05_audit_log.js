exports.up = async function(knex) {
  await knex.schema.createTable("audit_log", table => {
    table.increments("id").primary();
    table.string("event_type").notNullable();
    table.jsonb("payload").notNullable();
    table.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
  });

  await knex.schema.alterTable("audit_log", table => {
    table.index(["event_type"]);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTable("audit_log");
};
