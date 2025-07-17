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

  if (cmd === 'up') {
    const context = await loadContext(args.profile);
    console.log('Loaded context:', context);
    // Add logic to use the context for cluster operations
  } else {
    console.error(`Unknown command: ${cmd}`);
  }
}
