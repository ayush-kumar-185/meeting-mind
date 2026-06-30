const { Redis } = require('ioredis');

const connection = new Redis(process.env.UPSTASH_REDIS_URL, {
  maxRetriesPerRequest: null,
});

connection.on('connect', () => console.log('Redis connected'));
connection.on('error', (err) => console.error('Redis error:', err.message));

module.exports = connection;