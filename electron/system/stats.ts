import os from "node:os";

let prevIdle = 0;
let prevTotal = 0;

export function systemStats() {
  const cpus = os.cpus();
  const idle = cpus.reduce((a, c) => a + c.times.idle, 0);
  const total = cpus.reduce((a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0), 0);

  const idleDelta = idle - prevIdle;
  const totalDelta = total - prevTotal;
  const cpu = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;

  prevIdle = idle;
  prevTotal = total;

  return {
    cpu: Math.max(0, Math.min(100, cpu)),
    ramTotal: os.totalmem(),
    ramFree: os.freemem(),
    ramUsed: os.totalmem() - os.freemem(),
    platform: process.platform,
    arch: process.arch
  };
}