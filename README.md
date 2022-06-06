# node-synch

[![Build](https://img.shields.io/github/workflow/status/PotatoParser/node-synch/build%20&%20publish)](https://github.com/PotatoParser/node-synch/actions/workflows/main.yml) [![Coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fpotatoparser.github.io%2Fnode-synch%2Fcoverage.json)](https://potatoparser.github.io/node-synch/)

Synchronization Primitives in JavaScript

```js
/* Main thread */
import { Sema, Lock } from 'node-synch';

const sema = new Sema();
const lock = new Lock();

const worker = new Worker(...);

worker.postMessage({ sema, lock });

// Do something with the locks



/* Worker thread */
import { Sema, Lock } from 'node-synch';
import { mainThread } from 'worker_threads';

...
mainThread.on('message', ({ sema, lock }) => {
  sema = Sema.from(sema);
  lock = Lock.from(lock);
  
  // Do something with the locks
});
```

## Installation
`npm install node-synch`

## Features
- Synchronization Primitives
  - Semaphores
  - Locks; not to be confused with [Lock Web API](https://developer.mozilla.org/en-US/docs/Web/API/Lock)
- Browser support
- Synchronous and Asynchronous methods

### Table of Contents
- [Class: `Sema`](#class-sema)
  - [`Sema.from(sema)`](#semafromsema)
  - [`new Sema(init)`](#new-semainit)
  - [`sema.down()`](#semadown)
  - [`sema.downSync()`](#semadownsync)
  - [`sema.up()`](#semaup)
  - [`sema.value()`](#semavalue)
  - [`sema.clone()`](#semaclone)
  - [`sema.toString()`](#sematostring)
- [Class: `Lock`](#class-lock)
  - [`Lock.from(lock, tid)`](#lockfromlock-tid)
  - [`new Lock(tid)`](#new-locktid)
  - [`lock.acquire()`](#lockacquire)
  - [`lock.acquireSync()`](#lockacquiresync)
  - [`lock.release()`](#lockrelease)
  - [`lock.isLocked()`](#lockislocked)
  - [`lock.holder()`](#lockholder)
  - [`lock.tid()`](#locktid)
  - [`lock.clone()`](#lockclone)
  - [`lock.toString()`](#locktostring)

## Class: `Sema`
The `Sema` class represents a single instance of a semaphore. A semaphore is a synchronization primitive that keeps an internal counter. On attempting to decrement past 0, the decrementing thread is put to sleep until this counter is incremented again. To use semaphores in both a worker thread and the main thread, this class must be imported in both locations.

### `Sema.from(sema)`
- `sema` [\<Sema>](#new-semainit) A Sema object or a [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) Sema object to create a shared clone
- Returns: [\<Sema>](#new-semainit) A Sema object representing a shared copy of the semaphore.

```js
/* Main Thread */
import { Sema } from 'node-synch';

const sema = new Sema();

const worker = new Worker(..., {
  workerData: { sema }
});

await sema.down();
...
sema.up();



/* Worker Thread */
import { Sema } from 'node-synch';
import { workerData } from 'worker_threads';

let { sema } = workerData;

sema = Sema.from(sema);

await sema.down();
...
sema.up();
```

### `new Sema(init)`
- `init` [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) An optional non-negative Int-32 number representing the internal counter of the semaphore. This is used to determine the semaphore's value. **Default:** 1.

### `sema.down()`
- Returns: [\<Promise>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) -> [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Attempts to decrease the semaphore's internal counter. This will sleep the thread if counter is at 0. Unlike [sema.downSync()](#semadownsync), this method is asynchronous and non-blocking. Returns `Promise` that resolves to `true`.

```js
import { Sema } from 'node-synch';

const sema = new Sema();

await sema.down();

... // Critical section

sema.up();

```

### `sema.downSync()`
- Returns: [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Attempts to decrease the semaphore's internal counter. This will sleep the thread if counter is at 0. Unlike [sema.down()](#semadown), this method is synchronous and blocking. Returns `true`.

```js
import { Sema } from 'node-synch';

const sema = new Sema();

sema.downSync();

... // Critical section

sema.up();

```

### `sema.up()`
- Returns: [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Increases the internal counter of the semaphore. Wakes up threads that are waiting on the semaphore. Returns `true`.

### `sema.value()`
- Returns: [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type)

Returns the current value of the semaphore.

### `sema.clone()`
- Returns: [\<Sema>](#new-semainit)

Returns a shared copy of the semaphore.

### `sema.toString()`
- Returns: [\<string>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type)

Returns the string format for the semaphore.

## Class: `Lock`
The `Lock` class represents a single instance of a lock. To use locks in both a worker thread and the main thread, this class must be imported in both locations. Unlike [Lock Web API](https://developer.mozilla.org/en-US/docs/Web/API/Lock), this lock synchronization primitive stalls threads that attempt to hold it when it is held by another thread. Once unlocked, the waiting threads are woken up.

### `Lock.from(lock[, tid])`
- `lock` [\<Lock>](#new-locktid) A Lock object or a [structuredClone](https://developer.mozilla.org/en-US/docs/Web/API/structuredClone) Lock object to create a shared clone
- `tid` [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) An optional non-negative Int-32 number representing the tid of the lock. This is used to determine the holder when the lock is acquired. If not specified, the lock keeps an internal counter which it uses to determine the tid of the shared cloned Lock. **Default:** Next internal lock number.
- Returns: [\<Lock>](#new-locktid) A Lock object representing a shared copy of the lock.

```js
/* Main Thread */
import { Lock } from 'node-synch';

const lock = new Lock();

const worker = new Worker(..., {
  workerData: { lock }
});

await lock.acquire();
...
lock.release();



/* Worker Thread */
import { Lock } from 'node-synch';
import { workerData, threadId } from 'worker_threads';

let { lock } = workerData;

lock = Lock.from(lock, threadId);

await lock.acquire();
...
lock.release();
```

### `new Lock([tid])`
- `tid` [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type) An optional non-negative Int-32 number representing the tid of the lock. This is used to determine the holder when the lock is acquired. **Default:** 0.

### `lock.acquire()`
- Returns: [\<Promise>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) -> [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Attempts to acquire the lock with the internal tid. This will sleep the thread if the lock is already held by a different tid. Unlike [lock.acquireSync()](#lockacquiresync), this method is asynchronous and non-blocking. Returns `Promise` that resolves to `true` if the lock is currently not held, `false` if the lock is already held by the current tid.

```js
import { Lock } from 'node-synch';

const lock = new Lock();

await lock.acquire();

... // Critical section

lock.release();

```

### `lock.acquireSync()`
- Returns: [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Attempts to acquire the lock with the internal tid. This will sleep the thread if the lock is already held by a different tid. Unlike [lock.acquire()](#lockacquire), this method is synchronous and blocking. Returns `true` if the lock is currently not held, `false` if the lock is already held by the current tid.

```js

import { Lock } from 'node-synch';

const lock = new Lock();

lock.acquireSync();

... // Critical section

lock.release();

```

### `lock.release()`'
- Returns: [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Attempts to release the lock. Threads that are currently waiting on this lock are woken up. Returns `true` if the lock is held by the current thread, `false` otherwise.

### `lock.isLocked()`
- Returns: [\<boolean>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#boolean_type)

Returns `true` if the lock is held by a thread, `false` otherwise.

### `lock.holder()`
- Returns: [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type)

Returns the `tid` of the thread holding the lock, `-1` otherwise.

### `lock.tid()`
- Returns: [\<number>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#number_type)

Returns the internal `tid` of the lock clone/instance.

### `lock.clone()`
- Returns: [\<Lock>](#new-locktid)

Returns a shared copy of the lock.

### `lock.toString()`
- Returns: [\<string>](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#string_type)

Returns the string format for the lock.