import { Lock } from '../../lib/index.js';
import Worker from './worker.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('Lock class', () => {
  describe('Initialization', () => {
    test('should load default values', () => {
      const lock = new Lock();
      expect(lock.isLocked()).toBe(false);
      expect(lock.holder()).toBe(-1);
      expect(lock.tid()).toBe(0);
    });

    test('should accept different tid', () => {
      const lock = new Lock(12);
      expect(lock.isLocked()).toBe(false);
      expect(lock.holder()).toBe(-1);
      expect(lock.tid()).toBe(12);
    });

    test('should throw SyntaxError on non-Number tid', () => {
      expect(() => new Lock('test')).toThrow(new SyntaxError('Invalid tid'));
    });

    test('should throw SyntaxError on negative tid', () => {
      expect(() => new Lock(-1)).toThrow(new SyntaxError('Invalid tid'));
    });

    test('should throw SyntaxError on out of bounds tid', () => {
      expect(() => new Lock(2 ** 31)).toThrow(new SyntaxError('Invalid tid'));
    });
  });

  describe('Acquire', () => {
    describe('Synchronous', () => {
      test('should return true on first acquiring a lock', () => {
        const lock = new Lock();
        expect(lock.acquireSync()).toBe(true);
        expect(lock.holder()).toBe(0);
      });

      test('should return false on double acquire from same thread', () => {
        const lock = new Lock();
        lock.acquireSync();
        expect(lock.acquireSync()).toBe(false);
      });

      test('should be replicated', () => {
        const original = new Lock();
        const replica = original.clone();
        expect(original.acquireSync()).toBe(true);
        expect(original.release()).toBe(true);
        expect(replica.acquireSync()).toBe(true);
        expect(replica.release()).toBe(true);
        expect(replica.isLocked()).toBe(original.isLocked());
        expect(replica.holder()).toBe(original.holder());
      });

      test('should work in another thread', async () => {
        const lock = new Lock();
        await Worker.exec({ lock }, ({ lock }) => {
          lock = Lock.from(lock, threadId);
          lock.acquireSync();
        });
        expect(lock.isLocked()).toBe(true);
        expect(lock.holder()).not.toBe(0);
      });

      test('should be able to be released', () => {
        const lock = new Lock();
        lock.acquireSync();
        lock.release();

        expect(lock.isLocked()).toBe(false);
        expect(lock.holder()).toBe(-1);
      });

      test('should stall on double acquire', () => {
        const lock = new Lock();
        lock.acquireSync();
        expect(Worker.exec({ lock }, ({ lock }) => {
          lock = Lock.from(lock, threadId);
          lock.acquireSync();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      test('should wait for release', async () => {
        const lock = new Lock();
        const worker = new Worker();
        await worker.init({ lock }, async ({ lock }) => {
          lock = Lock.from(lock, threadId);
          lock.acquireSync();
          await sleep(200);
          lock.release();
        });
        const [, acq] = await Promise.all([worker.run(2001), (async () => {
          await sleep(100);
          return lock.acquireSync();
        })()]);
        expect(acq).toBe(true);
      });

      test('should block', () => {
        const lock = new Lock();
        lock.acquireSync();
        expect(Worker.exec({ lock }, ({ lock }) => {
          lock = Lock.from(lock, threadId);
          setTimeout(() => process.exit(0), 200);
          lock.acquireSync();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      describe('Fuzz testing', () => {
        test.each(Array(20).fill(0))('passes fuzz testing #%#', async () => {
          const threads = 8;
          const lock = new Lock();
          const workers = Worker.generate(threads);
          const threadId = null;

          const script = ({ lock }) => {
            lock = Lock.from(lock, threadId);
            assert.equal(lock.acquireSync(), true, 'Expected acquire to be true');
            assert.equal(lock.holder(), lock.tid());
            assert.equal(lock.release(), true, 'Expected release to be true');
          };

          await Promise.all(workers.map(worker => worker.init({ lock }, script)));
          await Promise.all(workers.map(worker => worker.run(-1)));
          expect(lock.isLocked()).toBe(false);
          expect(lock.holder()).toBe(-1);
        });
      });
    });

    describe('Asynchronous', () => {
      test('should return true on first acquiring a lock', async () => {
        const lock = new Lock();
        expect(await lock.acquire()).toBe(true);
        expect(lock.holder()).toBe(0);
      });

      test('should return false on double acquire from same thread', async () => {
        const lock = new Lock();
        await lock.acquire();
        expect(await lock.acquire()).toBe(false);
      });

      test('should be replicated', async () => {
        const original = new Lock();
        const replica = original.clone();
        expect(await original.acquire()).toBe(true);
        expect(original.release()).toBe(true);
        expect(await replica.acquire()).toBe(true);
        expect(replica.release()).toBe(true);
        expect(replica.isLocked()).toBe(original.isLocked());
        expect(replica.holder()).toBe(original.holder());
      });

      test('should work in another thread', async () => {
        const lock = new Lock();
        await Worker.exec({ lock }, async ({ lock }) => {
          lock = Lock.from(lock, threadId);
          await lock.acquire();
        });
        expect(lock.isLocked()).toBe(true);
        expect(lock.holder()).not.toBe(0);
      });

      test('should be able to be released', async () => {
        const lock = new Lock();
        await lock.acquire();
        lock.release();

        expect(lock.isLocked()).toBe(false);
        expect(lock.holder()).toBe(-1);
      });

      test('should stall on double acquire', async () => {
        const lock = new Lock();
        await lock.acquire();
        expect(Worker.exec({ lock }, async ({ lock }) => {
          lock = Lock.from(lock, threadId);
          await lock.acquire();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      test('should wait for release', async () => {
        const lock = new Lock();
        const worker = new Worker();
        await worker.init({ lock }, async ({ lock }) => {
          lock = Lock.from(lock, threadId);
          await lock.acquire();
          await sleep(200);
          lock.release();
        });
        const [, acq] = await Promise.all([worker.run(2001), (async () => {
          await sleep(100);
          return await lock.acquire();
        })()]);
        expect(acq).toBe(true);
      });

      test('should not block', async () => {
        const lock = new Lock();
        setTimeout(() => lock.release(), 30);
        expect(await lock.acquire()).toBe(true);
      });

      describe('Fuzz testing', () => {
        test.each(Array(20).fill(0))('passes fuzz testing #%#', async () => {
          const threads = 8;
          const lock = new Lock();
          const workers = Worker.generate(threads);
          const threadId = null;

          const script = async ({ lock }) => {
            lock = Lock.from(lock, threadId);
            assert.equal(await lock.acquire(), true, 'Expected acquire to be true');
            assert.equal(lock.holder(), lock.tid());
            assert.equal(lock.release(), true, 'Expected release to be true');
          };

          await Promise.all(workers.map(worker => worker.init({ lock }, script)));
          await Promise.all(workers.map(worker => worker.run(-1)));
          expect(lock.isLocked()).toBe(false);
          expect(lock.holder()).toBe(-1);
        });
      });
    });
  });

  describe('Release', () => {
    test('should not release initial lock', () => {
      const lock = new Lock();
      expect(lock.release()).toBe(false);
      expect(lock.isLocked()).toBe(false);
      expect(lock.holder()).toBe(-1);
    });

    test('should not double release on the same thread', async () => {
      const lock = new Lock();
      await lock.acquire();
      expect(lock.release()).toBe(true);
      expect(lock.release()).toBe(false);
      expect(lock.isLocked()).toBe(false);
      expect(lock.holder()).toBe(-1);
    });

    test('should not allow releasing from different thread', async () => {
      const lock = new Lock();
      await Worker.exec({ lock }, async ({ lock }) => {
        lock = Lock.from(lock, threadId);
        await lock.acquire();
      });
      expect(lock.release()).toBe(false);
    });
  });

  describe('Cloning', () => {
    test('should replicate when cloned from itself', () => {
      const original = new Lock();
      const replica = original.clone();
      original.acquireSync();
      expect(replica.isLocked()).toBe(original.isLocked());
      expect(replica.tid()).toBe(original.tid());
      expect(replica.holder()).toBe(original.holder());
    });

    test('should replicate when cloned using from', () => {
      const original = new Lock();
      const replica = Lock.from(original, original.tid());
      original.acquireSync();
      expect(replica.isLocked()).toBe(original.isLocked());
      expect(replica.tid()).toBe(original.tid());
      expect(replica.holder()).toBe(original.holder());
    });

    test('should replicate and assign new tid when no tid is given', () => {
      const original = new Lock();
      const replica = Lock.from(original);
      original.acquireSync();
      expect(replica.isLocked()).toBe(original.isLocked());
      expect(replica.tid()).not.toBe(original.tid());
      expect(replica.holder()).toBe(original.holder());
    });

    test('should replicate with given tid', () => {
      const original = new Lock();
      const replica = Lock.from(original, 12);
      original.acquireSync();
      expect(replica.isLocked()).toBe(original.isLocked());
      expect(replica.tid()).toBe(12);
      expect(replica.holder()).toBe(original.holder());
    });

    test('should throw SyntaxError on non-SharedArrayBuffer buffer property of Lock object', () => {
      expect(() => Lock.from({ buffer: 'test' })).toThrow(new SyntaxError('Invalid Lock object'));
    });

    test('should throw SyntaxError on invalid length SharedArrayBuffer buffer property of Lock object', () => {
      expect(() => Lock.from({ buffer: new SharedArrayBuffer(5) })).toThrow(new SyntaxError('Invalid Lock object'));
    });

    test('should throw SyntaxError on non-Number tid', () => {
      const lock = new Lock();
      expect(() => Lock.from(lock, 'test')).toThrow(new SyntaxError('Invalid tid'));
    });

    test('should throw SyntaxError on negative tid', () => {
      const lock = new Lock();
      expect(() => Lock.from(lock, -1)).toThrow(new SyntaxError('Invalid tid'));
    });

    test('should throw SyntaxError on out of bounds tid', () => {
      const lock = new Lock();
      expect(() => Lock.from(lock, 2 ** 31)).toThrow(new SyntaxError('Invalid tid'));
    });
  });

  describe('String format', () => {
    test('should display properly when unlocked', () => {
      const lock = new Lock();
      expect(`${lock}`).toBe('[unlocked] Lock');
    });

    test('should display properly when locked', () => {
      const lock = new Lock(12);
      lock.acquireSync();
      expect(`${lock}`).toBe('[LOCKED (12)] Lock');
    });
  });
});
