class Lock {
  /**
   * Create a new Lock object
   * @constructor
   * @param {number} [tid=0] - ID of the current thread
   */
  constructor(tid = 0) {
    if (typeof tid !== 'number' || tid < 0 || tid >= 2 ** 31) throw new SyntaxError('Invalid tid');
    this.buffer = new SharedArrayBuffer(12);
    this.lock = new Int32Array(this.buffer);
    this.lock[0] = 1;
    this.lock[1] = -1;
    this.lock[2] = tid;
    this.internalTid = tid;
  }

  /**
   * Releases the lock
   * Returns false if the current tid does not hold the lock
   * @returns {boolean}
   */
  release() {
    const holder = Atomics.load(this.lock, 1);
    if (holder === -1) return false;
    if (holder !== this.internalTid) return false;
    Atomics.store(this.lock, 1, -1);
    const old = Atomics.compareExchange(this.lock, 0, 0, 1);
    if (old === 1) return false;
    Atomics.notify(this.lock, 0, 1);
    return true;
  }

  /**
   * Asynchronously acquires the lock & waits if not possible
   * Returns false if the lock is already held by the tid
   * @returns {boolean}
   */
  async acquire() {
    for (;;) {
      const holder = Atomics.load(this.lock, 1);
      if (holder === this.internalTid) return false;
      const { value } = Atomics.wait(this.lock, 0, 0);
      await value;
      const old = Atomics.compareExchange(this.lock, 0, 1, 0);
      if (old === 0) continue;
      Atomics.store(this.lock, 1, this.internalTid);
      return true;
    }
  }

  /**
   * Synchronously acquires the lock & waits if not possible
   * Returns false if the lock is already held by the tid
   * @returns {boolean}
   */
  acquireSync() {
    for (;;) {
      const holder = Atomics.load(this.lock, 1);
      if (holder === this.internalTid) return false;
      Atomics.wait(this.lock, 0, 0);
      const old = Atomics.compareExchange(this.lock, 0, 1, 0);
      if (old === 0) continue;
      Atomics.store(this.lock, 1, this.internalTid);
      return true;
    }
  }

  /**
   * Creates a shared clone of the given lock
   * @param {Lock} lock - Lock object to clone from
   * @param {number} [tid=] - tid to assign to the lock; a new tid is generated if left blank
   * @returns {Lock} shared clone version of the given lock
   */
  static from({ buffer }, tid) {
    if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength !== 12) throw new SyntaxError('Invalid Lock object');
    if (arguments.length !== 1 && (typeof tid !== 'number' || tid < 0 || tid >= 2 ** 31)) throw new SyntaxError('Invalid tid');
    const lock = new Lock();
    lock.buffer = buffer;
    lock.lock = new Int32Array(lock.buffer);
    if (arguments.length === 1) tid = Atomics.add(lock.lock, 2, 1) + 1;
    lock.internalTid = tid;
    return lock;
  }

  /**
   * Creates a shared clone of the current lock
   * @returns {Lock} shared clone version of the given lock
   */
  clone() {
    return Lock.from(this, this.internalTid);
  }

  /**
   * The current holder of the lock
   * @returns {number} tid
   */
  holder() {
    return Atomics.load(this.lock, 1);
  }

  /**
   * The tid of the lock
   * @returns {number} tid
   */
  tid() {
    return this.internalTid;
  }

  /**
   * Returns true if the lock is locked
   * @returns {boolean}
   */
  isLocked() {
    return Atomics.load(this.lock, 0) === 0;
  }

  /**
   * Stringified lock
   * @returns {string} string representation of a lock
   */
  toString() {
    return `[${this.lock[0] === 1 ? 'unlocked' : `LOCKED (${this.lock[1]})`}] Lock`;
  }
}

export default Lock;
