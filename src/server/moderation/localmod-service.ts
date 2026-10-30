import { spawn, execSync, ChildProcess } from 'child_process';
import path from 'path';
import net from 'net';
import http from 'http';

let localModProcess: ChildProcess | null = null;
let shouldRun = false;
let isStarting = false;
let isRecycling = false;
let restartTimer: NodeJS.Timeout | null = null;
let watchdogInterval: NodeJS.Timeout | null = null;
let consecutiveCrashCount = 0;
let consecutiveUnhealthyChecks = 0;
const MAX_RAPID_CRASHES = 5;

/**
 * Checks whether port 8000 is currently occupied by any TCP listener.
 */
export function isPortListening(port = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(600);

    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.once('error', () => {
      resolve(false);
    });

    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Checks if LocalMod HTTP server is responding to /health.
 * Uses Node's native http module — NOT fetch() — to avoid Electron's Chromium
 * networking stack silently dropping loopback connections.
 */
export function isLocalModRunning(url = 'http://127.0.0.1:8000'): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`${url}/health`, { timeout: 4000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) return resolve(false);
        try {
          const parsed = JSON.parse(data);
          const required = ['toxicity', 'spam', 'pii'];
          const loaded = parsed.models_loaded || [];
          const allLoaded = required.every((m: string) => loaded.includes(m));
          resolve(allLoaded);
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Forcefully terminates a process and all its children across platforms.
 */
function killProcessTree(pid: number): void {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch {
    // Process might already be terminated
  }
}

/**
 * Frees port 8000 by terminating whichever stale process is listening on it.
 */
export function freePort(port = 8000): void {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' });
      for (const line of output.split('\n')) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5 && parts[1].endsWith(`:${port}`) && parts[3] === 'LISTENING') {
          const pid = Number(parts[4]);
          if (pid && pid > 0 && pid !== process.pid) {
            console.log(`[LocalMod] Terminating process (PID ${pid}) holding port ${port}...`);
            killProcessTree(pid);
          }
        }
      }
    }
  } catch {
    // Port was not occupied
  }
}

/**
 * Spawns the LocalMod server with proper path resolution, startup grace period, and error logging.
 */
async function spawnLocalModProcess(): Promise<void> {
  if (!shouldRun || isStarting) return;
  isStarting = true;

  try {
    // 1. If /health already responds, attach to existing instance
    if (await isLocalModRunning()) {
      console.log('[LocalMod] Healthy LocalMod instance already running on http://127.0.0.1:8000');
      consecutiveCrashCount = 0;
      consecutiveUnhealthyChecks = 0;
      isStarting = false;
      return;
    }

    // 2. If port 8000 is listening but /health failed multiple times, free the port
    if (await isPortListening(8000)) {
      console.warn('[LocalMod] Port 8000 occupied by unresponsive process. Freeing port...');
      freePort(8000);
      await new Promise(r => setTimeout(r, 800));
    }

    const runnerPath = path.resolve(process.cwd(), 'tools', 'localmod', 'run_server.py');
    const localModDir = path.resolve(process.cwd(), 'tools', 'localmod');
    const srcDir = path.resolve(localModDir, 'src');

    console.log('[LocalMod] Starting LocalMod moderation server via py...');

    localModProcess = spawn('py', [runnerPath], {
      cwd: localModDir,
      stdio: 'pipe',
      shell: true,
      env: {
        ...process.env,
        PYTHONPATH: [srcDir, process.env.PYTHONPATH].filter(Boolean).join(path.delimiter),
        PYTHONUNBUFFERED: '1',
        PYTHONIOENCODING: 'utf-8',
        LOCALMOD_LAZY_LOAD: 'false'
      }
    });

    const activePid = localModProcess.pid;

    localModProcess.stdout?.on('data', (d) => {
      const text = d.toString().trim();
      if (text.includes('Application startup complete') || text.includes('Uvicorn running on')) {
        console.log(`[LocalMod] ${text}`);
        consecutiveCrashCount = 0;
        consecutiveUnhealthyChecks = 0;
        isStarting = false;
      }
    });

    localModProcess.stderr?.on('data', (d) => {
      const text = d.toString().trim();
      if (text.includes('Uvicorn running on') || text.includes('Application startup complete')) {
        console.log(`[LocalMod] ${text}`);
        consecutiveCrashCount = 0;
        consecutiveUnhealthyChecks = 0;
        isStarting = false;
      } else if (text.includes('ERROR:') || text.includes('Traceback') || text.includes('[Errno 10048]')) {
        console.error(`[LocalMod err] ${text}`);
      }
    });

    localModProcess.on('exit', async (code) => {
      localModProcess = null;
      isStarting = false;

      if (!shouldRun || isRecycling) {
        return;
      }

      // Check if server is actually running (e.g. detached or in background)
      if (await isLocalModRunning()) {
        consecutiveCrashCount = 0;
        consecutiveUnhealthyChecks = 0;
        return;
      }

      consecutiveCrashCount++;
      console.warn(`[LocalMod Watchdog] Server process (PID ${activePid}) exited with code ${code} (crash count: ${consecutiveCrashCount}).`);

      if (consecutiveCrashCount >= MAX_RAPID_CRASHES) {
        console.error(`[LocalMod Watchdog] Server failed to start ${consecutiveCrashCount} times. Pausing restarts for 30s.`);
        if (restartTimer) clearTimeout(restartTimer);
        restartTimer = setTimeout(() => {
          consecutiveCrashCount = 0;
          spawnLocalModProcess();
        }, 30000);
        return;
      }

      // Exit code 3 in uvicorn indicates [Errno 10048] Address in use -> free the port
      if (code === 3) {
        freePort(8000);
      }

      const backoff = Math.min(consecutiveCrashCount * 1500, 5000);
      if (restartTimer) clearTimeout(restartTimer);
      restartTimer = setTimeout(() => {
        spawnLocalModProcess();
      }, backoff);
    });

    // Startup grace period: check for health within 10 seconds
    const startWait = Date.now();
    while (Date.now() - startWait < 10000) {
      await new Promise(r => setTimeout(r, 600));
      if (await isLocalModRunning()) {
        consecutiveCrashCount = 0;
        consecutiveUnhealthyChecks = 0;
        isStarting = false;
        break;
      }
    }
  } catch (err) {
    console.error('[LocalMod] Error during process spawn:', err);
    isStarting = false;
  }
}

/**
 * Starts and watchdogs the LocalMod moderation service.
 * Automatically launched by `yarn start` (Electron) or `yarn dev` (Server boot).
 */
export async function startLocalModService(): Promise<void> {
  if (shouldRun) return;
  shouldRun = true;

  await spawnLocalModProcess();

  // Active watchdog: checks /health every 15 seconds.
  // Requires 3 consecutive failures (45s of failure) before recycling to avoid false positives.
  if (!watchdogInterval) {
    watchdogInterval = setInterval(async () => {
      if (!shouldRun || isStarting) return;

      const healthy = await isLocalModRunning();
      if (healthy) {
        consecutiveCrashCount = 0;
        consecutiveUnhealthyChecks = 0;
      } else {
        consecutiveUnhealthyChecks++;
        console.warn(`[LocalMod Watchdog] Health check failed (${consecutiveUnhealthyChecks}/3).`);

        if (consecutiveUnhealthyChecks >= 3) {
          consecutiveUnhealthyChecks = 0;
          console.warn('[LocalMod Watchdog] Server unresponsive for 3 consecutive checks. Recycling...');

          isRecycling = true;
          if (localModProcess && localModProcess.pid) {
            killProcessTree(localModProcess.pid);
            localModProcess = null;
          }
          freePort(8000);
          await new Promise(r => setTimeout(r, 1000));
          isRecycling = false;

          spawnLocalModProcess();
        }
      }
    }, 15000);
  }

  const shutdown = () => stopLocalModService();
  process.on('exit', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/**
 * Stops the LocalMod service and disables the watchdog.
 */
export function stopLocalModService(): void {
  shouldRun = false;
  isStarting = false;
  isRecycling = true;

  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
  }

  if (localModProcess && localModProcess.pid) {
    killProcessTree(localModProcess.pid);
    localModProcess = null;
  }

  freePort(8000);
}
