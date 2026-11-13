import Redis from "ioredis";

export function redisUrl() {
  return process.env.REDIS_URL || "redis://localhost:6379";
}

export function createRedis() {
  return new Redis(redisUrl());
}
