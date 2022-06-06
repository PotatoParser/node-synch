import { Sema } from '../../lib/index.js';
import Worker from './worker.js';

function shuffle(array) {
  return array
    .map(i => ({
      i,
      s: Math.random()
    }))
    .sort((a, b) => a.s - b.s)
    .map(({ i }) => i);
}

describe('Semaphore class', () => {
  describe('Initialization', () => {
    test('should load default values', () => {
      const sema = new Sema();
      expect(sema.value()).toBe(1);
    });

    test('should accept different initial value', () => {
      const sema = new Sema(12);
      expect(sema.value()).toBe(12);
    });

    test('should throw SyntaxError on non-Number initial value', () => {
      expect(() => new Sema('test')).toThrow(new SyntaxError('Invalid initial value'));
    });

    test('should throw SyntaxError on negative initial value', () => {
      expect(() => new Sema(-1)).toThrow(new SyntaxError('Invalid initial value'));
    });

    test('should throw SyntaxError on out of bounds initial value', () => {
      expect(() => new Sema(2 ** 31)).toThrow(new SyntaxError('Invalid initial value'));
    });
  });

  describe('Down/P Operation', () => {
    describe('Synchronous', () => {
      test('should decrease the semaphore counter', () => {
        const sema = new Sema();
        sema.downSync();
        expect(sema.value()).toBe(0);
      });

      test('should be replicated', () => {
        const original = new Sema();
        const replica = original.clone();
        original.up();
        original.up();
        original.downSync();
        replica.up();
        replica.up();
        replica.downSync();
        expect(original.clone().value()).toBe(original.value());
        expect(replica.value()).toBe(original.value());
        expect(replica.clone().value()).toBe(original.value());
      });

      test('should stall when the semaphore is permanently 0', () => {
        const sema = new Sema(0);
        expect(Worker.exec({ sema }, ({ sema }) => {
          sema = Sema.from(sema);
          sema.downSync();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      test('should block', () => {
        const sema = new Sema(0);
        expect(Worker.exec({ sema }, ({ sema }) => {
          sema = Sema.from(sema);
          setTimeout(() => sema.up(), 200);
          sema.downSync();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      test('should work on another thread', async () => {
        const init = 12;
        const sema = new Sema(init);
        await Worker.exec({ sema }, ({ sema }) => {
          sema = Sema.from(sema);
          sema.downSync();
        });
        expect(sema.value()).toBe(init - 1);
      });

      describe('Fuzz testing', () => {
        test.each(Array(20).fill(0))('passes fuzz testing #%#', async () => {
          const threads = 8;
          const init = 12;
          const sema = new Sema(init);
          const up = ({ sema }) => {
            sema = Sema.from(sema);
            sema.up();
          };
          const down = ({ sema }) => {
            sema = Sema.from(sema);
            sema.downSync();
          };
          const scripts = shuffle(Array(threads).fill(0).map((_, i) => (i % 2 ? up : down)));
          const workers = Worker.generate(threads);
          await Promise.all(workers.map((worker, i) => worker.init({ sema }, scripts[i])));
          await Promise.all(workers.map(worker => worker.run()));
          expect(sema.value()).toBe(init);
        });
      });
    });

    describe('Asynchronous', () => {
      test('should decrease the semaphore counter', async () => {
        const sema = new Sema();
        expect(await sema.down()).toBe(true);
        expect(sema.value()).toBe(0);
      });

      test('should be replicated', async () => {
        const original = new Sema();
        const replica = original.clone();
        original.up();
        original.up();
        await original.down();
        replica.up();
        replica.up();
        await replica.down();
        expect(original.clone().value()).toBe(original.value());
        expect(replica.value()).toBe(original.value());
        expect(replica.clone().value()).toBe(original.value());
      });

      test('should stall when the semaphore is permanently 0', () => {
        const sema = new Sema(0);
        expect(Worker.exec({ sema }, async ({ sema }) => {
          sema = Sema.from(sema);
          await sema.down();
        })).rejects.toEqual(new Error('TIMEOUT'));
      });

      test('should not block', async () => {
        const sema = new Sema(0);
        setTimeout(() => sema.up(), 30);
        await sema.down();
        expect(sema.value()).toBe(0);
      });

      test('should work on another thread', async () => {
        const init = 12;
        const sema = new Sema(init);
        await Worker.exec({ sema }, async ({ sema }) => {
          sema = Sema.from(sema);
          await sema.down();
        });
        expect(sema.value()).toBe(init - 1);
      });

      describe('Fuzz testing', () => {
        test.each(Array(20).fill(0))('passes fuzz testing #%#', async () => {
          const threads = 8;
          const init = 12;
          const sema = new Sema(init);
          const up = ({ sema }) => {
            sema = Sema.from(sema);
            sema.up();
          };
          const down = async ({ sema }) => {
            sema = Sema.from(sema);
            await sema.down();
          };
          const scripts = shuffle(Array(threads).fill(0).map((_, i) => (i % 2 ? up : down)));
          const workers = Worker.generate(threads);
          await Promise.all(workers.map((worker, i) => worker.init({ sema }, scripts[i])));
          await Promise.all(workers.map(worker => worker.run()));
          expect(sema.value()).toBe(init);
        });
      });
    });
  });

  describe('Up/V Operation', () => {
    test('should increase the semaphore counter', () => {
      const sema = new Sema();
      expect(sema.up()).toBe(true);
      expect(sema.value()).toBe(2);
    });
  });

  describe('Cloning', () => {
    test('should replicate when cloned from itself', () => {
      const original = new Sema();
      const replica = original.clone();
      original.up();
      original.downSync();
      expect(replica.value()).toBe(original.value());
    });

    test('should replicate when cloned using from', () => {
      const original = new Sema();
      const replica = Sema.from(original);
      original.up();
      original.downSync();
      expect(replica.value()).toBe(original.value());
    });

    test('should throw SyntaxError on non-SharedArrayBuffer buffer property of Lock object', () => {
      expect(() => Sema.from({ buffer: 'test' })).toThrow(new SyntaxError('Invalid semaphore'));
    });

    test('should throw SyntaxError on invalid length SharedArrayBuffer buffer property of Lock object', () => {
      expect(() => Sema.from({ buffer: new SharedArrayBuffer(5) })).toThrow(new SyntaxError('Invalid semaphore'));
    });
  });

  describe('String format', () => {
    test('should display properly', () => {
      const sema = new Sema(12);
      expect(`${sema}`).toBe('Sema(12)');
    });
  });
});
