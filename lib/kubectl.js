import { spawn } from './utils.js'

/**
 * Use labels to find matching kinds
 * kind string
 * labels array
 * returns JSON
 */
export async function search (kind, labels = []) {
  const args = [
    'get',
    kind,
    '--output=json'
  ]

  if (labels.length > 0) {
    args.push(`--selector=${labels.join(',')}`)
  }

  const kubectlResult = await spawn('kubectl', args)

  return JSON.parse(kubectlResult.stdout)
}

export async function waitFor (kind, resourceName, condition, { context }) {
  const k8sArgs = []
  /*
    `--kubeconfig=${kubeconfig}`,
    `--context=${context}`,
   */

  await spawn('kubectl', [
    'wait',
    `--for=condition=${condition}`,
    '--timeout=1500s',
    `${kind.toLowerCase()}/${resourceName}`
  ])
}
