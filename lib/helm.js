import { spawn } from './utils.js'

function k8sArgs (k8s = {}) {
  const args = []

  if (k8s.contextName) {
    args.push(`--kube-context=${k8s.contextName}`)
  }

  return args
}

/**
 * Performs a `helm upgrade --install` against a chart with given values.
 * Values are added in the same order as CLI where order of precedence is
 * increasing from first to last.
 *
 * `helm update` or `helm add` must be run separately.
 */
export async function apply (releaseName, chart, values = [], version = null, k8s = {}) {
  const args = [
    'upgrade',
    '--install',
    releaseName,
    chart,
    ...values.map(v => `--values=${v}`)
  ]
  if (version) {
    args.push(`--version=${version}`)
  }

  args.push(...k8sArgs(k8s))

  await spawn('helm', args)
}

/**
 */
export async function addRepo (repoName, address, version = null, k8s = {}) {
  const args = [
    'repo',
    'add',
    repoName,
    address,
    '--force-update'
  ]
  if (version) {
    args.push(`--version=${version}`)
  }

  args.push(...k8sArgs(k8s))

  await spawn('helm', args)
}
