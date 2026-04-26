const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'invoices_db',
  user: process.env.DB_USER || 'invoice_user',
  password: process.env.DB_PASSWORD || 'invoice_pass',
});

const initDb = async () => {
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS invoices_schema;

    CREATE TABLE IF NOT EXISTS invoices_schema.invoices (
      id SERIAL PRIMARY KEY,
      invoice_number VARCHAR(50) UNIQUE NOT NULL,
      customer_id INTEGER NOT NULL,
      customer_name VARCHAR(255),
      customer_email VARCHAR(255),
      status VARCHAR(50) DEFAULT 'draft',
      subtotal NUMERIC(10, 2) DEFAULT 0.00,
      tax NUMERIC(10, 2) DEFAULT 0.00,
      total NUMERIC(10, 2) DEFAULT 0.00,
      notes TEXT,
      created_by INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS invoices_schema.invoice_items (
      id SERIAL PRIMARY KEY,
      invoice_id INTEGER REFERENCES invoices_schema.invoices(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name VARCHAR(255),
      quantity INTEGER NOT NULL DEFAULT 1,
      unit_price NUMERIC(10, 2) NOT NULL,
      line_total NUMERIC(10, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED
    );
  `);
  console.log('Invoices DB schema initialized');
};

module.exports = { pool, initDb };
