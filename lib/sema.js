class Sema {
  /**
   * Create a new Semaphore object
   * @constructor
   * @param {number} [init=1] - The initial value of the semaphore
   */
  constructor(init = 1) {
    if (typeof init !== 'number' || init < 0 || init >= 2 ** 31) throw new SyntaxError('Invalid initial value');
    this.buffer = new SharedArrayBuffer(4);
    this.sema = new Int32Array(this.buffer);
    this.sema[0] = init;
  }

  /**
   * Increases the counter of the semaphore; V operation
   * @returns {boolean} true
   */
  up() {
    Atomics.add(this.sema, 0, 1);
    Atomics.notify(this.sema, 0, 1);
    return true;
  }

  /**
   * Asynchronously decreases the counter of the semaphore
   * & waits if not possible; P operation
   * @returns {Promise<boolean>} A promise that resolves to true
   */
  async down() {
    for (;;) {
      let val = Atomics.load(this.sema, 0);
      if (val === 0) {
        const {
          value
        } = Atomics.waitAsync(this.sema, 0, 0);
        await value;
      }
      val = Atomics.load(this.sema, 0);
      if (val === 0) continue;
      const old = Atomics.compareExchange(this.sema, 0, val, val - 1);
      if (old === val) break;
    }
    return true;
  }

  /**
   * Synchronously decreases the counter of the semaphore
   * & waits if not possible; P operation
   * @returns {boolean} true
   */
  downSync() {
    for (;;) {
      let val = Atomics.load(this.sema, 0);
      if (val === 0) Atomics.wait(this.sema, 0, 0);
      val = Atomics.load(this.sema, 0);
      if (val === 0) continue;
      const old = Atomics.compareExchange(this.sema, 0, val, val - 1);
      if (old === val) break;
    }
    return true;
  }

  /**
   * Internal value of the semaphore
   * @returns {number} the current counter of the semaphore
   */
  value() {
    return Atomics.load(this.sema, 0);
  }

  /**
   * Creates a shared clone of the given semaphore
   * Usually used within a thread after passing the structuredCloned semaphore
   * @param {Sema} sema - Semaphore object
   * @returns {Sema} shared clone version of the given semaphore
   */
  static from({ buffer }) {
    if (!(buffer instanceof SharedArrayBuffer) || buffer.byteLength !== 4) throw new SyntaxError('Invalid semaphore');
    const sema = new Sema();
    sema.buffer = buffer;
    sema.sema = new Int32Array(sema.buffer);
    return sema;
  }

  /**
   * Creates a shared clone of the current semaphore
   * @returns {Sema} shared clone version of the current semaphore
   */
  clone() {
    return Sema.from({ buffer: this.buffer });
  }

  /**
   * Stringified semaphore
   * @returns {string} string representation of a semaphore
   */
  toString() {
    return `Sema(${this.sema[0]})`;
  }
}

export default Sema;
