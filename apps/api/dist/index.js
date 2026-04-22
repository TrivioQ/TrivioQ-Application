'use strict';
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, '__esModule', { value: true });
const express_1 = __importDefault(require('express'));
const database_1 = require('@trivioq/database');
const user_1 = __importDefault(require('./routes/user'));
const drop_1 = __importDefault(require('./routes/drop'));
const leaderboard_1 = __importDefault(require('./routes/leaderboard'));
const auth_1 = __importDefault(require('./routes/auth'));
const env_1 = require('./config/env');
const app = (0, express_1.default)();
const port = env_1.env.PORT;
app.use(express_1.default.json());
app.use('/api/v1/auth', auth_1.default);
app.use('/api/v1/users', user_1.default);
app.use('/api/v1/drops', drop_1.default);
app.use('/api/v1/leaderboards', leaderboard_1.default);
app.get('/health', async (req, res) => {
  try {
    // Simple db query to check if DB connection is alive
    await database_1.prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: String(error),
    });
  }
});
// Example route using shared-types to verify compilation
app.post('/preferences', (req, res) => {
  const prefs = req.body;
  res.json({ received: prefs });
});
app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
