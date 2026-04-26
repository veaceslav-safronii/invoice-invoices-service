require('dotenv').config();
const express = require('express');
const { initDb } = require('./db');
const invoicesRoutes = require('./routes/invoices');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());
app.use('/invoices', invoicesRoutes);

app.get('/', (req, res) => {
  res.json({ service: 'invoice-invoices-service', version: '1.0.0', status: 'running' });
});

const start = async () => {
  let retries = 10;
  while (retries > 0) {
    try {
      await initDb();
      break;
    } catch (err) {
      console.log(`DB not ready, retrying... (${retries} left)`);
      retries--;
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  app.listen(PORT, () => {
    console.log(`Invoices service running on port ${PORT}`);
  });
};

start();
