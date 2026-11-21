import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import app from './app.js';

const server = app.listen(env.port, () => console.log(`PDF Pro Cut API listening on ${env.port}`));
server.headersTimeout = 30_000;
server.requestTimeout = 300_000;
server.keepAliveTimeout = 5_000;

if (env.mongoUri) {
  connectDb(env.mongoUri)
    .then(() => console.log('MongoDB connected'))
    .catch((error) => {
      const detail = env.nodeEnv === 'development' ? ` ${error.message}` : '';
      console.warn(`MongoDB unavailable; PDF tools remain available. Accounts require MongoDB.${detail}`);
    });
}
