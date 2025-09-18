import { spawn } from './utils.js'

export async function execute (connectionString, scriptPath) {
  // await spawn('psql', [connectionString, '-f', scriptPath])
  // await spawn('kubectl', ['exec', 'postgres-0', '--', 'psql', '<', scriptPath])
  await spawn('sh', ['-c', `kubectl exec -i postgres-0 -- psql < "${scriptPath}"`])
}
