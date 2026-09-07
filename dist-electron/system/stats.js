"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemStats = systemStats;
const node_os_1 = __importDefault(require("node:os"));
let prevIdle = 0;
let prevTotal = 0;
function systemStats() {
    const cpus = node_os_1.default.cpus();
    const idle = cpus.reduce((a, c) => a + c.times.idle, 0);
    const total = cpus.reduce((a, c) => a + Object.values(c.times).reduce((x, y) => x + y, 0), 0);
    const idleDelta = idle - prevIdle;
    const totalDelta = total - prevTotal;
    const cpu = totalDelta > 0 ? Math.round((1 - idleDelta / totalDelta) * 100) : 0;
    prevIdle = idle;
    prevTotal = total;
    return {
        cpu: Math.max(0, Math.min(100, cpu)),
        ramTotal: node_os_1.default.totalmem(),
        ramFree: node_os_1.default.freemem(),
        ramUsed: node_os_1.default.totalmem() - node_os_1.default.freemem(),
        platform: process.platform,
        arch: process.arch
    };
}
