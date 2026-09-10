export interface LogEntry {
  id: string;
  timestamp: string;
  category: 'PEER' | 'FIREBASE' | 'HOST' | 'CLIENT' | 'MESSAGE' | 'ERROR';
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private listeners: Set<(logs: LogEntry[]) => void> = new Set();
  private maxLogs = 100;

  public log(category: LogEntry['category'], message: string, data?: any) {
    const time = new Date().toLocaleTimeString();
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: time,
      category,
      message,
      data
    };
    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }
    console.log(`[DEBUG][${category}][${time}] ${message}`, data !== undefined ? data : '');
    this.notify();
  }

  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  public clear() {
    this.logs = [];
    this.notify();
  }

  public subscribe(listener: (logs: LogEntry[]) => void) {
    this.listeners.add(listener);
    listener([...this.logs]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const current = [...this.logs];
    this.listeners.forEach(l => l(current));
  }
}

export const debugLogger = new DebugLogger();
