import fs from 'fs';
import path from 'path';

export interface WorkflowLogEntry {
  ts: string;
  level: 'info' | 'warn' | 'error';
  phase: string;
  message: string;
}

const MAX_LOG_BYTES = 50 * 1024 * 1024;

/**
 * Per-job append-only JSONL logger. Writes one line per call and tees to
 * console.* so container stdout (docker logs / GlitchTip) is preserved.
 * Sync writes keep ordering stable for concurrent SSE tail readers and
 * survive worker crashes without a WriteStream.end() flush.
 */
export class WorkflowLogger {
  private fd: number;
  private readonly logPath: string;

  constructor(logPath: string) {
    this.logPath = logPath;
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    this.fd = fs.openSync(logPath, 'a');
  }

  info(phase: string, message: string): void {
    console.log(`[${phase}] ${message}`);
    this.write('info', phase, message);
  }

  warn(phase: string, message: string): void {
    console.warn(`[${phase}] ${message}`);
    this.write('warn', phase, message);
  }

  error(phase: string, message: string): void {
    console.error(`[${phase}] ${message}`);
    this.write('error', phase, message);
  }

  /** Rotate workflow.log -> workflow.log.1 and open a fresh empty file. */
  truncate(): void {
    try {
      fs.closeSync(this.fd);
      const prev = this.logPath + '.1';
      if (fs.existsSync(prev)) fs.unlinkSync(prev);
      if (fs.existsSync(this.logPath)) fs.renameSync(this.logPath, prev);
      this.fd = fs.openSync(this.logPath, 'a');
    } catch (e) {
      console.error('[WorkflowLogger] truncate failed:', e);
    }
  }

  close(): void {
    try {
      fs.closeSync(this.fd);
    } catch {
      // already closed or file gone
    }
  }

  private write(level: 'info' | 'warn' | 'error', phase: string, message: string): void {
    const entry: WorkflowLogEntry = { ts: new Date().toISOString(), level, phase, message };
    const line = JSON.stringify(entry) + '\n';
    try {
      this.rotateIfTooLarge();
      fs.writeSync(this.fd, line);
    } catch (e) {
      console.error('[WorkflowLogger] write failed:', e);
    }
    // Tee to container stdout — never replace console.
    if (level === 'error') console.error(`[${phase}] ${message}`);
    else if (level === 'warn') console.warn(`[${phase}] ${message}`);
    else console.log(`[${phase}] ${message}`);
  }

  private rotateIfTooLarge(): void {
    let stat;
    try {
      stat = fs.fstatSync(this.fd);
    } catch {
      return;
    }
    if (stat.size < MAX_LOG_BYTES) return;
    fs.closeSync(this.fd);
    const prev = this.logPath + '.1';
    if (fs.existsSync(prev)) fs.unlinkSync(prev);
    if (fs.existsSync(this.logPath)) fs.renameSync(this.logPath, prev);
    this.fd = fs.openSync(this.logPath, 'a');
  }
}
