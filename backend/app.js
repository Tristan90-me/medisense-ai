// Configures and exports the Express app WITHOUT calling .listen() — split
// out from server.js so tests (supertest) can import the app directly
// without needing a real running server or a live DB connection.
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');

const app = express();

// Mounted before helmet() specifically so helmet's default Content-Security-
// Policy (which blocks the inline scripts/styles swagger-ui-express ships)
// never applies to this path — everything else still gets the full
// helmet() treatment below.
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const allowedOrigins = [
  'http://localhost:5173',
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/admin/auth', require('./routes/adminAuth'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({
  status: 'MediSense API running',
  env: process.env.NODE_ENV,
}));

app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

module.exports = app;
