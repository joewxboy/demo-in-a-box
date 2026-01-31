import { createWriteStream, WriteStream } from 'fs';

export class OperationLogger {
  private stream: WriteStream | null = null;

  constructor(private logPath: string) {}

  start(): void {
    this.stream = createWriteStream(this.logPath, { flags: 'a' });
  }

  write(data: string): void {
    if (this.stream) {
      this.stream.write(data);
    }
  }

  writeLine(line: string): void {
    this.write(line + '\n');
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.stream) {
        resolve();
        return;
      }

      this.stream.end((error: Error | undefined) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}
