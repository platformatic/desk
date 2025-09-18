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

export async function waitByName (kind, resourceName, condition, k8sContext = {}) {
  const k8s = []
  const { kubeContext, namespace } = k8sContext
  if (kubeContext) k8s.push(`--context=${kubeContext}`)
  if (namespace) k8s.push(`--namespace=${namespace}`)

  await spawn('kubectl', [
    ...k8s,
    'wait',
    `--for=condition=${condition}`,
    '--timeout=1500s',
    `${kind.toLowerCase()}/${resourceName}`
  ])
}

export async function waitBySelector (kind, selectorKV, condition, k8sContext = {}) {
  const k8s = []
  const { kubeContext, namespace } = k8sContext
  if (kubeContext) k8s.push(`--context=${kubeContext}`)
  if (namespace) k8s.push(`--namespace=${namespace}`)

  const selectors = Object.entries(selectorKV).map(([key, val]) => `${key}=${val}`)

  await spawn('kubectl', [
    ...k8s,
    'wait',
    `--for=condition=${condition}`,
    '--timeout=1500s',
    kind,
    `--selector=${selectors.join(',')}`
  ])
}

export async function createDockerRegistrySecret (secretName, server, username, password, k8sContext = {}) {
  const k8s = []
  const { kubeContext, namespace } = k8sContext
  if (kubeContext) k8s.push(`--context=${kubeContext}`)
  if (namespace) k8s.push(`--namespace=${namespace}`)

  // Delete existing secret if it exists (ignore errors)
  try {
    await spawn('kubectl', [
      ...k8s,
      'delete',
      'secret',
      secretName
    ])
  } catch {
    // Ignore errors - secret might not exist
  }

  // Create the docker-registry secret
  await spawn('kubectl', [
    ...k8s,
    'create',
    'secret',
    'docker-registry',
    secretName,
    `--docker-server=${server}`,
    `--docker-username=${username}`,
    `--docker-password=${password}`
  ])
}
