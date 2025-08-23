import { spawn } from './utils.js'

export async function execute (connectionString, scriptPath) {
  await spawn('psql', [connectionString, '-f', scriptPath])
}
