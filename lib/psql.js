import { spawn } from './utils.js'

export async function execute (connectionString, scriptPath) {
  await spawn('sh', ['-c', `kubectl exec -i postgres-0 -- psql < "${scriptPath}"`])
}
