const express = require('express');
const axios = require('axios');
const { pool } = require('../db');
const { authenticate } = require('../middleware');

const router = express.Router();

const CUSTOMERS_SERVICE_URL = process.env.CUSTOMERS_SERVICE_URL || 'http://customers:3002';
const PRODUCTS_SERVICE_URL = process.env.PRODUCTS_SERVICE_URL || 'http://products:3003';

const generateInvoiceNumber = () => {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `INV-${timestamp}-${random}`;
};

// GET /invoices - list all invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices_schema.invoices ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /invoices/:id - get invoice with items
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoiceResult = await pool.query(
      'SELECT * FROM invoices_schema.invoices WHERE id = $1',
      [req.params.id]
    );
    if (invoiceResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const itemsResult = await pool.query(
      'SELECT * FROM invoices_schema.invoice_items WHERE invoice_id = $1',
      [req.params.id]
    );

    res.json({ ...invoiceResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /invoices - create invoice (business logic: fetch customer + products, calc total)
router.post('/', authenticate, async (req, res) => {
  try {
    const { customer_id, items, notes } = req.body;
    // items: [{ product_id, quantity }]

    if (!customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'customer_id and items[] are required' });
    }

    const authHeader = req.headers['authorization'];

    // Fetch customer from Customers Service
    const customerRes = await axios.get(
      `${CUSTOMERS_SERVICE_URL}/customers/${customer_id}`,
      { headers: { authorization: authHeader } }
    );
    const customer = customerRes.data;

    // Fetch each product and build invoice items
    const invoiceItems = [];
    let subtotal = 0;

    for (const item of items) {
      const productRes = await axios.get(
        `${PRODUCTS_SERVICE_URL}/products/${item.product_id}`,
        { headers: { authorization: authHeader } }
      );
      const product = productRes.data;
      const lineTotal = parseFloat(product.price) * item.quantity;
      subtotal += lineTotal;

      invoiceItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        unit_price: parseFloat(product.price),
      });
    }

    const tax = subtotal * 0.19; // 19% TVA Romania
    const total = subtotal + tax;
    const invoiceNumber = generateInvoiceNumber();

    // Insert invoice
    const invoiceResult = await pool.query(
      `INSERT INTO invoices_schema.invoices
        (invoice_number, customer_id, customer_name, customer_email, subtotal, tax, total, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [invoiceNumber, customer_id, customer.name, customer.email,
       subtotal.toFixed(2), tax.toFixed(2), total.toFixed(2), notes, req.user.userId]
    );

    const invoice = invoiceResult.rows[0];

    // Insert invoice items
    for (const item of invoiceItems) {
      await pool.query(
        `INSERT INTO invoices_schema.invoice_items (invoice_id, product_id, product_name, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5)`,
        [invoice.id, item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }

    const itemsResult = await pool.query(
      'SELECT * FROM invoices_schema.invoice_items WHERE invoice_id = $1',
      [invoice.id]
    );

    res.status(201).json({ ...invoice, items: itemsResult.rows });
  } catch (err) {
    if (err.response) {
      return res.status(err.response.status).json({ error: err.response.data.error });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /invoices/:id/status - update invoice status
router.patch('/:id/status', authenticate, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['draft', 'sent', 'paid', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const result = await pool.query(
      'UPDATE invoices_schema.invoices SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/health/check', (req, res) => {
  res.json({ status: 'ok', service: 'invoices-service' });
});

module.exports = router;
