// Debug logger for streaming
export class StreamDebugger {
  private logs: Array<{ timestamp: number; type: string; data: any }> = [];
  private startTime: number;

  constructor() {
    this.startTime = Date.now();
  }

  log(type: string, data: any) {
    const entry = {
      timestamp: Date.now() - this.startTime,
      type,
      data,
    };
    this.logs.push(entry);
    console.log(`[STREAM-DEBUG][${entry.timestamp}ms][${type}]`, data);
  }

  error(type: string, error: any) {
    this.log(`ERROR:${type}`, {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
      code: error?.code,
      ...error,
    });
  }

  getDump() {
    return {
      totalTime: Date.now() - this.startTime,
      logs: this.logs,
    };
  }
}
