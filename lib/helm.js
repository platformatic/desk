import { debug, spawn, warn } from './utils.js'
import * as kubectl from './kubectl.js'

function k8sArgs (k8s = {}) {
  const args = []

  if (k8s.contextName) {
    args.push(`--kube-context=${k8s.contextName}`)
  }

  if (k8s.namespace) {
    args.push('--create-namespace')
    args.push(`--namespace=${k8s.namespace}`)
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
export async function apply (releaseName, chart, valueFilePaths = [], version = null, k8s = {}) {
  const args = [
    'upgrade',
    '--install',
    releaseName,
    chart,
    ...valueFilePaths.map(v => `--values=${v}`)
  ]
  if (version) {
    args.push(`--version=${version}`)
  }

  args.push(...k8sArgs(k8s))

  try {
    const { stdout } = await spawn('helm', args)
    debug({ stdout, chart })
    return parseNotes(stdout)
  } catch (err) {
    debug({ err })
    const errorDetail = parseHelmError(err.output)
    warn(`Applying Helm for release '${errorDetail.releaseName}' failed. Waiting for '${errorDetail.apiVersion}/${errorDetail.kind}' to be ready`)
    const crdName = await getCrdName(errorDetail.kind, errorDetail.apiVersion)
    await kubectl.waitFor('crd', crdName, 'established')
    return apply(releaseName, chart, valueFilePaths, version, k8s)
  }
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

function parseHelmError (errorMessage) {
  debug({ errorMessage })
  const result = {
    releaseName: null,
    kind: null,
    apiVersion: null
  }

  const releaseMatch = errorMessage.match(/Release "([^"]+)"/)
  if (releaseMatch) {
    result.releaseName = releaseMatch[1]
  }

  const kindMatch = errorMessage.match(/no matches for kind "([^"]+)"/)
  if (kindMatch) {
    result.kind = kindMatch[1]
  }

  const versionMatch = errorMessage.match(/in version "([^"]+)"/)
  if (versionMatch) {
    result.apiVersion = versionMatch[1]
  }

  return result
}

function parseNotes (output) {
  const lines = output.split('\n')
  const notesIndex = lines.findIndex(line => line.trim() === 'NOTES:')

  if (notesIndex === -1) {
    return null
  }

  const notesContent = lines.slice(notesIndex + 1).join('\n').trim()
  debug({ notesContent })

  try {
    return JSON.parse(notesContent)
  } catch (err) {
    warn(`Failed to parse NOTES JSON: ${err.message}`)
    return null
  }
}

async function getCrdName (kind, apiVersion) {
  const group = apiVersion.includes('/') ? apiVersion.split('/')[0] : null

  if (!group) return '' // Core resources don't have CRDs

  const allCrds = await kubectl.search('crd')

  return allCrds.items
    .filter(item =>
      item.spec?.names?.kind === kind &&
      item.spec?.group === group
    )
    .map(item => item.metadata.name)[0]
}
