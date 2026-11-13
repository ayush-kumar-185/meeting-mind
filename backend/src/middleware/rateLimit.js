const redis = require('../lib/redis');

/**
 * Basic Fixed Window rate limiter using a Lua script for atomicity.
 * @param {number} limit - Max requests per window
 * @param {number} windowSeconds - Window size in seconds
 */
const rateLimit = (limit, windowSeconds) => {
  return async (req, res, next) => {
    // Group by IP, or by user ID if authenticated
    const identifier = req.user ? req.user._id.toString() : req.ip;
    const routePattern = req.route ? req.route.path : 'global';
    const bucket = `${req.baseUrl || ''}:${routePattern}`;
    const key = `ratelimit:${bucket}:${identifier}`;

    try {
      // Atomic Fixed Window: Increment and set expiry only if it's the first request
      const luaScript = `
        local current = redis.call("INCR", KEYS[1])
        if current == 1 then
          redis.call("EXPIRE", KEYS[1], ARGV[1])
        end
        return current
      `;
      
      const current = await redis.eval(luaScript, 1, key, windowSeconds);

      if (current > limit) {
        return res.status(429).json({ 
          error: 'Too many requests, please try again later.',
          retryAfter: windowSeconds 
        });
      }

      next();
    } catch (err) {
      // If Redis fails, log it and allow the request through so the API stays up
      console.error('Redis rate limit error:', err.message);
      next();
    }
  };
};

module.exports = rateLimit;
