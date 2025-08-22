import { spawn } from './utils.js'

/**
 * Use labels to find matching kinds
 * kind string
 * labels array
 * returns JSON
 */
export async function search (kind, labels) {
  const kubectlResult = await spawn('kubectl', [
    'get',
    kind,
    `--selector=${labels.join(',')}`,
    '--output=json'
  ])

  return JSON.parse(kubectlResult.stdout)
}
