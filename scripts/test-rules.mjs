import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const host = '127.0.0.1';
const port = 8082;
const projectId = 'demo-sismoconnect';
const config = 'firebase.test.json';
const jestConfig = 'jest.rules.config.js';
const firebaseBin = join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const jestBin = join(root, 'node_modules', 'jest', 'bin', 'jest.js');
const logLimit = 200_000;

let emulatorProcess;
let emulatorLog = '';
let emulatorExit;
let startupError;
let javaPid;
let startedEmulator = false;
let cleanupPromise;
let handlingSignal = false;

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function info(message) {
  console.log(`[test:rules] ${message}`);
}

function fail(message) {
  console.error(`[test:rules] ${message}`);
}

function appendLog(chunk) {
  emulatorLog += chunk.toString();
  if (emulatorLog.length > logLimit) {
    emulatorLog = emulatorLog.slice(-logLimit);
  }
}

function printEmulatorTail() {
  const tail = emulatorLog.trim().split(/\r?\n/).slice(-60).join('\n');
  if (!tail) return;
  console.error('\n--- Últimas líneas del emulador ---');
  console.error(tail);
  console.error('--- Fin del emulador ---\n');
}

function isJavaName(name) {
  return typeof name === 'string' && name.toLowerCase().replace(/\.exe$/, '').startsWith('java');
}

function isPortOpen() {
  return new Promise((resolvePromise) => {
    const socket = net.createConnection({ host, port });
    let settled = false;

    function finish(open) {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolvePromise(open);
    }

    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

function getWindowsProcessInfo(pid) {
  const command = [
    `$process = Get-Process -Id ${pid} -ErrorAction SilentlyContinue`,
    `if ($process) { Write-Output "$($process.ProcessName)|$($process.Id)" }`,
  ].join('; ');

  try {
    const output = execFileSync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    ).trim();
    const line = output.split(/\r?\n/).find((value) => /^\d+\|/.test(value));
    if (!line) return null;
    const [pidText, name] = line.split('|');
    const foundPid = Number(pidText);
    return Number.isInteger(foundPid) && foundPid > 0 ? { pid: foundPid, name } : null;
  } catch {
    return null;
  }
}

function getWindowsPortOwner() {
  const command = [
    `$connection = Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1`,
    'if (-not $connection) { exit 0 }',
    `$process = Get-Process -Id $connection.OwningProcess -ErrorAction SilentlyContinue`,
    `if ($process) { Write-Output "$($connection.OwningProcess)|$($process.ProcessName)" }`,
  ].join('; ');

  try {
    const output = execFileSync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
    ).trim();
    const line = output.split(/\r?\n/).find((value) => /^\d+\|/.test(value));
    if (!line) return null;
    const [pidText, name] = line.split('|');
    const foundPid = Number(pidText);
    return Number.isInteger(foundPid) && foundPid > 0 ? { pid: foundPid, name } : null;
  } catch {
    return null;
  }
}

function getProcessInfo(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return null;
  if (process.platform === 'win32') return getWindowsProcessInfo(pid);

  try {
    const name = execFileSync('ps', ['-p', String(pid), '-o', 'comm='], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return name ? { pid, name } : null;
  } catch {
    return null;
  }
}

function getPortOwner() {
  if (process.platform === 'win32') return getWindowsPortOwner();

  try {
    const output = execFileSync(
      'lsof',
      ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }
    ).trim();
    const pid = Number(output.split(/\s+/)[0]);
    if (!Number.isInteger(pid) || pid <= 0) return null;
    const processInfo = getProcessInfo(pid);
    return processInfo ? { pid, name: processInfo.name } : null;
  } catch {
    return null;
  }
}

function getChildProcesses(parentPid) {
  if (!Number.isInteger(parentPid) || parentPid <= 0) return [];

  if (process.platform === 'win32') {
    const command = [
      `Get-CimInstance Win32_Process -Filter "ParentProcessId = ${parentPid}"`,
      'ForEach-Object { Write-Output "$($_.ProcessId)|$($_.Name)" }',
    ].join(' | ');

    try {
      const output = execFileSync(
        'powershell.exe',
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command],
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true }
      ).trim();
      return output
        .split(/\r?\n/)
        .map((line) => {
          const [pidText, name] = line.split('|');
          const foundPid = Number(pidText);
          return Number.isInteger(foundPid) && foundPid > 0 && name
            ? { pid: foundPid, name }
            : null;
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  try {
    const output = execFileSync('pgrep', ['-P', String(parentPid)], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return output
      .split(/\s+/)
      .map((value) => getProcessInfo(Number(value)))
      .filter(Boolean);
  } catch {
    return [];
  }
}

function findJavaChild(parentPid) {
  return getChildProcesses(parentPid).find((child) => isJavaName(child.name)) ?? null;
}

function killProcess(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return;

  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
    });
    return;
  }

  spawnSync('kill', ['-KILL', String(pid)], { stdio: 'ignore' });
}

async function waitForPortClosed(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isPortOpen())) return true;
    await sleep(200);
  }
  return false;
}

async function ensurePortFree() {
  if (!(await isPortOpen())) return;

  const owner = getPortOwner();
  const details = owner ? ` por ${owner.name} (PID ${owner.pid})` : '';
  throw new Error(
    `El puerto ${port} ya está ocupado${details}. Cierra ese proceso manualmente; ` +
      'el runner no reutiliza ni detiene procesos ajenos.'
  );
}

function startEmulator() {
  info(`Iniciando Firestore en ${host}:${port} (${projectId})...`);
  startedEmulator = true;
  emulatorProcess = spawn(
    process.execPath,
    [
      firebaseBin,
      'emulators:start',
      '--config',
      config,
      '--only',
      'firestore',
      '--project',
      projectId,
    ],
    {
      cwd: root,
      detached: true,
      env: { ...process.env, GCLOUD_PROJECT: projectId },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    }
  );

  emulatorProcess.stdout?.on('data', appendLog);
  emulatorProcess.stderr?.on('data', appendLog);

  emulatorProcess.once('error', (error) => {
    startupError = error;
    appendLog(`No se pudo iniciar Firebase: ${error.message}\n`);
  });

  emulatorProcess.once('exit', (code, signal) => {
    emulatorExit = { code, signal };
    appendLog(`Firebase terminó (código ${code}, señal ${signal ?? 'ninguna'}).\n`);
  });
}

async function waitForEmulator(timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (startupError) {
      throw new Error(`No se pudo iniciar el emulador: ${startupError.message}`);
    }
    if (emulatorExit) {
      throw new Error(
        `El emulador terminó antes de estar listo (código ${emulatorExit.code}, ` +
          `señal ${emulatorExit.signal ?? 'ninguna'}).`
      );
    }
    if (await isPortOpen()) {
      await sleep(300);
      return;
    }
    await sleep(250);
  }

  throw new Error(`El emulador no abrió ${host}:${port} en ${timeoutMs / 1000} segundos.`);
}

function identifyJavaProcess() {
  const owner = getPortOwner();
  if (!owner) {
    throw new Error(`No se pudo identificar el proceso que escucha en ${host}:${port}.`);
  }
  if (!isJavaName(owner.name)) {
    throw new Error(
      `El puerto ${port} lo ocupa ${owner.name} (PID ${owner.pid}), no Java. ` +
        'No se detendrá ese proceso.'
    );
  }

  javaPid = owner.pid;
  info(`Emulador listo; Java PID ${javaPid}.`);
}

function runJest() {
  info('Ejecutando tests de reglas...');
  return new Promise((resolvePromise) => {
    const child = spawn(
      process.execPath,
      [jestBin, '--config', jestConfig, '--runInBand'],
      {
        cwd: root,
        env: {
          ...process.env,
          FIRESTORE_EMULATOR_HOST: `${host}:${port}`,
          GCLOUD_PROJECT: projectId,
        },
        stdio: 'inherit',
        windowsHide: true,
      }
    );

    child.once('error', (error) => {
      fail(`No se pudo ejecutar Jest: ${error.message}`);
      resolvePromise(1);
    });

    child.once('exit', (code, signal) => {
      if (signal) {
        fail(`Jest terminó por la señal ${signal}.`);
        resolvePromise(1);
        return;
      }
      resolvePromise(code ?? 1);
    });
  });
}

async function doCleanup() {
  if (!startedEmulator) return true;

  let ok = true;
  let owner = javaPid ? getProcessInfo(javaPid) : null;

  if (!owner) {
    owner = getPortOwner();
  }

  if (!owner && emulatorProcess && getProcessInfo(emulatorProcess.pid)) {
    owner = findJavaChild(emulatorProcess.pid);
  }

  if (owner) {
    if (!isJavaName(owner.name)) {
      fail(
        `El puerto ${port} lo ocupa ${owner.name} (PID ${owner.pid}); no se detiene.`
      );
      ok = false;
    } else {
      info(`Deteniendo Java PID ${owner.pid}...`);
      killProcess(owner.pid);
    }
  }

  if (emulatorProcess && getProcessInfo(emulatorProcess.pid)) {
    killProcess(emulatorProcess.pid);
  }

  const portClosed = await waitForPortClosed();
  if (!portClosed) {
    fail(`El puerto ${port} sigue ocupado después de detener el emulador.`);
    ok = false;
  }

  if (owner && isJavaName(owner.name)) {
    for (let attempt = 0; attempt < 25 && getProcessInfo(owner.pid); attempt += 1) {
      await sleep(200);
    }
    if (getProcessInfo(owner.pid)) {
      fail(`Java PID ${owner.pid} sigue vivo después de detener el emulador.`);
      ok = false;
    }
  }

  if (emulatorProcess) {
    for (
      let attempt = 0;
      attempt < 25 && getProcessInfo(emulatorProcess.pid);
      attempt += 1
    ) {
      await sleep(200);
    }
    if (getProcessInfo(emulatorProcess.pid)) {
      fail(`Firebase PID ${emulatorProcess.pid} sigue vivo después de la limpieza.`);
      ok = false;
    }
  }

  if (ok) {
    info(`Emulador detenido; ${host}:${port} libre.`);
  }

  return ok;
}

function cleanup() {
  cleanupPromise ??= doCleanup();
  return cleanupPromise;
}

async function handleSignal(signal) {
  if (handlingSignal) return;
  handlingSignal = true;
  fail(`Recibido ${signal}; deteniendo el emulador...`);
  await cleanup();
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.once('SIGINT', () => void handleSignal('SIGINT'));
process.once('SIGTERM', () => void handleSignal('SIGTERM'));

let exitCode = 1;

try {
  if (!existsSync(firebaseBin)) {
    throw new Error(`No se encontró Firebase CLI en ${firebaseBin}.`);
  }
  if (!existsSync(jestBin)) {
    throw new Error(`No se encontró Jest en ${jestBin}.`);
  }

  await ensurePortFree();
  startEmulator();
  await waitForEmulator();
  identifyJavaProcess();
  exitCode = await runJest();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
  printEmulatorTail();
  exitCode = 1;
} finally {
  const cleaned = await cleanup();
  if (!cleaned) {
    fail('La limpieza no terminó correctamente.');
    exitCode = 1;
  }
}

process.exit(exitCode);
