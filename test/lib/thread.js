// eslint-disable-next-line no-unused-vars
import { parentPort, threadId } from 'worker_threads';

// eslint-disable-next-line no-unused-vars
import assert from 'assert';

// eslint-disable-next-line no-unused-vars
import { Sema, Lock } from '../../lib/index.js';

// eslint-disable-next-line no-unused-vars
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

let data, exec;

parentPort.on('message', async ({ type, ...msg }) => {
  switch (type) {
    case 'INIT': {
      data = msg.data;
      // eslint-disable-next-line no-eval
      exec = eval(msg.script);
      parentPort.postMessage('ACK_INIT');
      break;
    }
    case 'RUN': {
      await exec(data);
      process.exit(0);
      break;
    }
    default: break;
  }
});
