/**
 * Redis resilience check — verifies graceful degradation WITHOUT a real Redis.
 *
 * Each scenario runs in its own process (config is read from the environment
 * once per process), so the whole check is reproducible on any machine:
 *
 *   1. disabled   REDIS_ENABLED=false → no client, no commands, cache is a no-op.
 *   2. unreachable dead port          → cache calls return in ms, never throw.
 *   3. quota      connected server that answers every data command with
 *                 "-ERR max requests limit exceeded" (what Upstash returns when
 *                 the monthly limit is hit):
 *                   • breaker OPENS after 3 failures,
 *                   • then ZERO commands are sent (no retry storm, no quota),
 *                   • after the cooldown exactly ONE probe is sent,
 *                   • a successful probe closes the breaker and caching resumes.
 *
 * Usage: pnpm --filter api check:redis
 */

import net from 'node:net';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const argv = process.argv.slice(2);
const isChild = argv.includes('--child');
const caseName = argv.find((a) => a.startsWith('--case='))?.split('=')[1] ?? '';

const CASES = ['disabled', 'unreachable', 'quota'] as const;

function baseEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    NODE_ENV: 'test',
    REDIS_CONNECT_TIMEOUT_MS: '1000',
    REDIS_COMMAND_TIMEOUT_MS: '500',
    REDIS_MAX_RECONNECT_ATTEMPTS: '2',
    REDIS_RECONNECT_COOLDOWN_MS: '500',
    REDIS_BREAKER_COOLDOWN_MS: '300',
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Fake Redis (only the RESP subset ioredis needs) ─────────────────────────

type Cmd = string[];

function parseCommands(buffer: Buffer): { commands: Cmd[]; rest: Buffer } {
  const commands: Cmd[] = [];
  let offset = 0;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0x2a /* '*' */) {
      const nl = buffer.indexOf('\r\n', offset);
      if (nl === -1) break;
      offset = nl + 2;
      continue;
    }
    const lineEnd = buffer.indexOf('\r\n', offset);
    if (lineEnd === -1) break;
    const count = Number(buffer.subarray(offset + 1, lineEnd).toString());
    let cursor = lineEnd + 2;
    const args: string[] = [];
    let complete = true;

    for (let i = 0; i < count; i += 1) {
      if (buffer[cursor] !== 0x24 /* '$' */) {
        complete = false;
        break;
      }
      const lenEnd = buffer.indexOf('\r\n', cursor);
      if (lenEnd === -1) {
        complete = false;
        break;
      }
      const len = Number(buffer.subarray(cursor + 1, lenEnd).toString());
      const start = lenEnd + 2;
      if (buffer.length < start + len + 2) {
        complete = false;
        break;
      }
      args.push(buffer.subarray(start, start + len).toString());
      cursor = start + len + 2;
    }

    if (!complete) break;
    commands.push(args);
    offset = cursor;
  }

  return { commands, rest: buffer.subarray(offset) };
}

async function startFakeRedis() {
  let healthy = false;
  let count = 0;
  const log: string[] = [];

  const sockets = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    let buffer = Buffer.alloc(0);
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const parsed = parseCommands(buffer);
      buffer = parsed.rest;

      for (const cmd of parsed.commands) {
        const name = (cmd[0] || '').toLowerCase();
        // Handshake/readiness commands always succeed: ioredis needs INFO to
        // reach the `ready` state the quota scenario is about.
        if (name === 'info' || name === 'client' || name === 'select') {
          const info = '# Server\r\nredis_version:7.0.0\r\n';
          socket.write(`$${Buffer.byteLength(info)}\r\n${info}\r\n`);
          continue;
        }
        count += 1;
        log.push(name);
        if (!healthy) {
          // Exactly what Upstash returns once the monthly limit is exhausted.
          socket.write('-ERR max requests limit exceeded. Limit: 500000, Usage: 500001\r\n');
          continue;
        }
        if (name === 'get') socket.write('$-1\r\n');
        else if (name === 'ping') socket.write('+PONG\r\n');
        else if (name === 'incr') socket.write(':1\r\n');
        else if (name === 'del') socket.write(':1\r\n');
        else socket.write('+OK\r\n');
      }
    });
    socket.on('error', () => undefined);
  });

  const port: number = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) resolve(address.port);
      else reject(new Error('no address'));
    });
  });

  return {
    port,
    commandCount: () => count,
    commandLog: () => [...log],
    setHealthy: (value: boolean) => {
      healthy = value;
    },
    close: () =>
      new Promise<void>((resolve) => {
        // server.close() waits for open sockets; force them shut so the child
        // process can never hang here.
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

async function freeClosedPort(): Promise<number> {
  const server = net.createServer();
  const port: number = await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) resolve(address.port);
      else reject(new Error('no address'));
    });
  });
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}

// ─── Assertions ─────────────────────────────────────────────────────────────

const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown): void {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ─── Scenarios ──────────────────────────────────────────────────────────────

async function runDisabled(): Promise<void> {
  process.env.REDIS_ENABLED = 'false';
  process.env.REDIS_URL = 'redis://127.0.0.1:1';

  const redis = await import('../src/plugins/redis');
  const safe = await import('../src/plugins/redis-safe');

  const started = Date.now();
  redis.startRedis();
  const value = await safe.cacheGet('events:list:nothing');
  const ping = await safe.pingRedis();
  const elapsed = Date.now() - started;

  check('getRedis() returns null — no connection created', redis.getRedis() === null);
  check('cacheGet() returns undefined without throwing', value === undefined);
  check('pingRedis() reports "disabled"', ping.status === 'disabled', ping);
  check('no delay (fail-fast)', elapsed < 250, { ms: elapsed });
}

async function runUnreachable(): Promise<void> {
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_URL = `redis://127.0.0.1:${await freeClosedPort()}`;

  const redis = await import('../src/plugins/redis');
  const safe = await import('../src/plugins/redis-safe');

  redis.startRedis();
  const started = Date.now();
  const results = await Promise.all(Array.from({ length: 10 }, () => safe.cacheGet('event:1')));
  const elapsed = Date.now() - started;

  check('10 concurrent cacheGet() calls return undefined', results.every((r) => r === undefined), results);
  check('they return quickly (no hanging requests)', elapsed < 2_000, { ms: elapsed });
  await redis.closeRedis();
}

async function runQuota(): Promise<void> {
  const fake = await startFakeRedis();
  process.env.REDIS_ENABLED = 'true';
  process.env.REDIS_URL = `redis://127.0.0.1:${fake.port}`;

  try {
    const redis = await import('../src/plugins/redis');
    const safe = await import('../src/plugins/redis-safe');
    redis.startRedis();

    let ready = false;
    for (let i = 0; i < 40; i += 1) {
      const client = redis.getRedis();
      if (client && client.status === 'ready') {
        ready = true;
        break;
      }
      await sleep(50);
    }
    check('client reached ready against fake Redis', ready);

    const before = fake.commandCount();
    const results: unknown[] = [];
    for (let i = 0; i < 6; i += 1) results.push(await safe.cacheGet(`event:${i}`));
    const issuedWhileFailing = fake.commandCount() - before;

    check('failing cacheGet() degrades to undefined', results.every((r) => r === undefined));
    check('breaker OPEN after repeated failures', safe.getRedisCircuitState() === 'open', safe.getRedisCircuitState());
    check('stops issuing commands once open (≤3 attempts)', issuedWhileFailing <= 3, { issuedWhileFailing });

    const afterOpen = fake.commandCount();
    const openedAt = Date.now();
    const duringOpen: unknown[] = [];
    for (let i = 0; i < 20; i += 1) duringOpen.push(await safe.cacheGet(`event:open:${i}`));
    const openElapsed = Date.now() - openedAt;

    check('20 calls while open issue ZERO Redis commands', fake.commandCount() === afterOpen, {
      extra: fake.commandCount() - afterOpen,
    });
    check('calls while open are instant', openElapsed < 200, { ms: openElapsed });
    check('all calls while open return undefined', duringOpen.every((r) => r === undefined));

    const degradedPing = await safe.pingRedis();
    check('pingRedis() reports degraded', degradedPing.status === 'degraded', degradedPing);
    check('ping while open costs nothing', fake.commandCount() === afterOpen);

    // Provider recovers.
    fake.setHealthy(true);
    await sleep(400); // > REDIS_BREAKER_COOLDOWN_MS (300ms)
    check('circuit reports half-open after cooldown', safe.getRedisCircuitState() === 'half-open');

    const beforeRecovery = fake.commandCount();
    const recovered = await safe.cacheGet<string>('events:list:epoch');
    const recoveryCommands = fake.commandCount() - beforeRecovery;

    check('recovery probe is exactly ONE command', recoveryCommands === 1, { recoveryCommands });
    check('probe result returned as a normal cache miss', recovered === undefined);
    check('breaker CLOSED after successful probe', safe.getRedisCircuitState() === 'closed', safe.getRedisCircuitState());

    const beforeNormal = fake.commandCount();
    await safe.cacheSet('event:42', { ok: true }, 60);
    await safe.cacheIncr('events:list:epoch');
    const normalCommands = fake.commandCount() - beforeNormal;
    check('normal caching resumes', normalCommands >= 2, { normalCommands, log: fake.commandLog().slice(-3) });

    await redis.closeRedis();
  } finally {
    await fake.close();
  }
}

async function main(): Promise<void> {
  console.log('\nRedis resilience check');
  console.log('──────────────────────');

  const runner = { disabled: runDisabled, unreachable: runUnreachable, quota: runQuota };
  console.log(`\n[${caseName}]`);
  await runner[caseName as keyof typeof runner]();

  console.log('──────────────────────');
  if (failures.length > 0) {
    console.log(`RESULT: FAILED (${failures.length}) → ${failures.join(' | ')}\n`);
    process.exit(1);
  }
  console.log('RESULT: PASSED\n');
  process.exit(0);
}

if (!isChild) {
  const script = fileURLToPath(import.meta.url);
  let exitCode = 0;

  for (const name of CASES) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', script, '--child', `--case=${name}`], {
      cwd: path.resolve(path.dirname(script), '..'),
      env: baseEnv(),
      stdio: 'inherit',
    });
    if (result.status !== 0) {
      console.log(`  scenario '${name}' exited with status=${String(result.status)} signal=${String(result.signal)} error=${result.error?.message ?? 'none'}`);
      exitCode = 1;
    }
  }

  console.log(exitCode === 0 ? 'All resilience checks passed.' : 'Redis resilience checks FAILED.');
  process.exit(exitCode);
} else {
  void main();
}
