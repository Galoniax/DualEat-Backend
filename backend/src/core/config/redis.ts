import Redis from 'ioredis';

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || undefined,
  retryDelayOnFailover: 100,
  lazyConnect: true,
};

export const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => {
  console.log("✅ Redis conectado a", redisConfig.host);
});

redisClient.on('ready', () => {
  console.log('✅ Redis listo para usar');
});

redisClient.on('error', (err) => {
  console.warn('⚠️ Redis error:', err.message);
});
