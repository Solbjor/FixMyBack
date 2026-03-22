const express = require('express');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');
const { Server } = require('socket.io');

// Load environment variables from .env.local in the root directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 1e7,
});

const AI_AUTOSTART = process.env.AI_AUTOSTART !== 'false';
const AI_SOCKET_URL = process.env.AI_SOCKET_URL || 'http://localhost:4000';
const AI_WORKDIR = process.env.AI_WORKDIR || path.resolve(__dirname, '../AI-section');
const defaultPythonPath =
  process.platform === 'win32'
    ? path.join(AI_WORKDIR, '.venv', 'Scripts', 'python.exe')
    : path.join(AI_WORKDIR, '.venv', 'bin', 'python');
const AI_START_CMD =
  process.env.AI_START_CMD || `"${defaultPythonPath}" main.py --stream --socket ${AI_SOCKET_URL}`;

let aiProcess = null;
let aiStarting = false;

function isAiRunning() {
  return !!aiProcess && aiProcess.exitCode === null && !aiProcess.killed;
}

function ensureAiBridgeRunning() {
  return new Promise((resolve, reject) => {
    if (!AI_AUTOSTART) {
      return resolve('disabled');
    }

    if (isAiRunning()) {
      return resolve('already-running');
    }

    if (aiStarting) {
      return resolve('starting');
    }

    aiStarting = true;
    console.log(`[AI] Starting stream bridge with command: ${AI_START_CMD}`);

    let settled = false;
    const finish = (err, status) => {
      if (settled) return;
      settled = true;
      aiStarting = false;
      if (err) reject(err);
      else resolve(status);
    };

    try {
      aiProcess = spawn(AI_START_CMD, {
        cwd: AI_WORKDIR,
        shell: true,
        windowsHide: false,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });
    } catch (error) {
      aiProcess = null;
      return finish(error);
    }

    aiProcess.stdout?.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.log(`[AI] ${text}`);
    });

    aiProcess.stderr?.on('data', (data) => {
      const text = data.toString().trim();
      if (text) console.error(`[AI:ERR] ${text}`);
    });

    aiProcess.on('error', (error) => {
      aiProcess = null;
      finish(error);
    });

    aiProcess.on('exit', (code, signal) => {
      const message = `[AI] Stream bridge exited (code=${code ?? 'null'}, signal=${signal ?? 'none'})`;
      console.log(message);
      aiProcess = null;
      if (!settled) {
        finish(new Error('AI process exited during startup'));
      }
    });

    // Consider startup successful if process stays alive for a few seconds.
    setTimeout(() => {
      if (isAiRunning()) {
        finish(null, 'started');
      } else {
        finish(new Error('AI process did not stay alive after launch'));
      }
    }, 3000);
  });
}

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('device connected:', socket.id);

  // Frame relay (PC → relay → AI & app)
  socket.on('frame', (data) => socket.broadcast.emit('frame', data));

  // Calibration control
  socket.on('calibrate-start', async () => {
    console.log('[CALIBRATE] Start signal received');

    try {
      const aiStatus = await ensureAiBridgeRunning();
      if (aiStatus === 'started') {
        console.log('[CALIBRATE] AI bridge auto-started successfully');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to launch AI bridge';
      console.error('[CALIBRATE] Could not start AI bridge:', message);
      socket.emit('calibration-failed', {
        message: `Could not start AI bridge: ${message}`,
      });
      return;
    }

    console.log('[CALIBRATE] Broadcasting calibration start to AI listeners...');
    socket.broadcast.emit('calibrate-start');
  });

  // AI → App alerts
  socket.on('posture-alert', (data) => {
    console.log('[ALERT]', data.message);
    socket.broadcast.emit('posture-alert', data);
  });

  // Calibration completion
  socket.on('calibration-complete', (data) => {
    console.log('[CALIBRATION COMPLETE]', data.message);
    socket.broadcast.emit('calibration-complete', data);
  });

  socket.on('calibration-failed', (data) => {
    console.log('[CALIBRATION FAILED]', data?.message || 'unknown reason');
    socket.broadcast.emit('calibration-failed', data);
  });

  // Session stop → let AI emit summary, then kill
  socket.on('session-stop', () => {
    console.log('[SESSION] Stop signal received');
    socket.broadcast.emit('session-stop');
    if (aiProcess && !aiProcess.killed) {
      // Give the AI bridge 3 seconds to emit session-summary before killing
      setTimeout(() => {
        if (aiProcess && !aiProcess.killed) {
          console.log('[AI] Killing stream bridge process...');
          aiProcess.kill();
          aiProcess = null;
        }
      }, 3000);
    }
  });

  // AI → App: session summary (score, duration, stats)
  socket.on('session-summary', (data) => {
    console.log('[SESSION SUMMARY]', JSON.stringify(data));
    socket.broadcast.emit('session-summary', data);
  });

  // Legacy events
  socket.on('posture-data', (data) => {
    socket.broadcast.emit('posture-update', data);
  });
  socket.on('session-control', (data) => {
    socket.broadcast.emit('session-command', data);
  });

  socket.on('disconnect', () => {
    console.log('device disconnected:', socket.id);
  });
});

server.listen(4000, () => {
  console.log('server running on port 4000');
  if (AI_AUTOSTART) {
    console.log(`[AI] Auto-start enabled. Workdir: ${AI_WORKDIR}`);
  }
});