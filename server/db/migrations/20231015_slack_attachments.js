exports.up = function(knex) {
  return knex.schema.createTable('slack_attachments', (table) => {
    table.increments('id').primary();
    table.string('message_id').references('id').inTable('slack_messages');
    table.string('file_id').unique();
    table.string('s3_url');
    table.string('mime_type');
    table.integer('size');
    table.timestamp('created_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('slack_attachments');
};