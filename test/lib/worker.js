import { Worker as WorkerThread } from 'worker_threads';

class Worker {
  static generate(num) {
    return Array(num).fill(0).map(() => new Worker());
  }

  constructor() {
    this.worker = new WorkerThread('./test/lib/thread.js');
  }

  init(data, script) {
    return new Promise(resolve => {
      this.worker.once('message', () => {
        resolve();
      });
      this.worker.postMessage({
        type: 'INIT',
        data,
        script: script.toString()
      });
    });
  }

  run(timeout = 1000) {
    return new Promise((resolve, reject) => {
      let timer = 0;
      if (timeout !== -1) {
        timer = setTimeout(() => {
          this.worker.terminate();
          reject(new Error('TIMEOUT'));
        }, timeout);
      }
      this.worker.on('error', reject);
      this.worker.on('exit', code => {
        if (timeout !== -1) clearTimeout(timer);
        if (code === 0) resolve(true);
        else reject(new Error(`Thread exited with error: ${code}`));
      });
      this.worker.postMessage({ type: 'RUN' });
    });
  }

  static async exec(data, script) {
    const worker = new Worker();
    await worker.init(data, script);
    await worker.run();
  }
}

export default Worker;
