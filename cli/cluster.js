import minimist from 'minimist';
import { loadContext } from '../lib/context.js';

export default async function cli(argv) {
  const args = minimist(argv, {
    string: ['profile'],
    alias: {
      profile: 'p',
    }
  });
  const [cmd] = args._;

  const context = await loadContext(args.profile);

  if (cmd === 'up') {
  } else if (cmd === 'down') {
  } else if (cmd === 'status') {
  } else {
    console.error(`Unknown command: ${cmd}`);
  }
}
