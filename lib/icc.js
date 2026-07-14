import { addToRun } from './run-directory.js'
import { info, warn } from './utils.js'

// Drive a deploy through ICC's deploy API instead of templating the workload
// locally. Manage mode applies it; advise mode returns a plan for the caller.
//
// Auth is a scoped deploy token (Bearer plt_deploy_...), the same CI path a
// customer would use. icc.plt uses a local/self-signed cert, so TLS verification
// is disabled for this call (dev/testing tool).
export async function deployViaIcc ({ iccUrl, appId, token, image, version, hostname, namespace, minReplicas, maxReplicas, env, expirePolicy }) {
  // With an app id: the app-scoped route. Without: the token-scoped route, where
  // ICC resolves the application from the deploy token (a CI needs only the token).
  const base = iccUrl.replace(/\/+$/, '')
  const url = appId
    ? `${base}/control-plane/applications/${appId}/deploy`
    : `${base}/control-plane/deploy`

  const body = { image, version }
  if (hostname) body.hostname = hostname
  if (namespace) body.namespace = namespace
  if (minReplicas) body.minReplicas = minReplicas
  if (maxReplicas) body.maxReplicas = maxReplicas
  if (env && Object.keys(env).length) body.env = env
  if (expirePolicy) body.expirePolicy = expirePolicy

  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    })
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) {
      throw new Error(`ICC deploy failed (${res.status}): ${json?.message ?? text}`)
    }
    return json
  } finally {
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls
  }
}

// Report the outcome of a manage-mode ICC deploy. Advise plans are handled by
// the deploy CLI before this function is called.
export function handleIccDeploy (result) {
  if (result.deployed) {
    info(`\nICC created the workload (${result.controllerName ?? 'Deployment'} + Service). The pod will register and the version will go active.`)
    return
  }
  warn('ICC deploy returned deployed=false; nothing to do.')
}

// Shared ICC request helper. icc.plt uses a local/self-signed cert, so TLS
// verification is disabled for the call (dev/testing tool only).
async function iccRequest (url, { method = 'GET', token, body } = {}) {
  const prevTls = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  try {
    const headers = { authorization: `Bearer ${token}` }
    const opts = { method, headers }
    if (body !== undefined) {
      headers['content-type'] = 'application/json'
      opts.body = JSON.stringify(body)
    }
    const res = await fetch(url, opts)
    const text = await res.text()
    let json
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) throw new Error(`ICC request failed (${res.status}): ${json?.message ?? text}`)
    return json
  } finally {
    if (prevTls === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    else process.env.NODE_TLS_REJECT_UNAUTHORIZED = prevTls
  }
}

// Read-only: the deploy plan for a NEW version (Deployment + Service + HTTPRoute).
// ICC mutates nothing whatever the app's mode. Returns { intent, mode, plan }.
export async function getDeployPlan ({ iccUrl, appId, token, image, version, hostname, namespace, minReplicas, maxReplicas, env }) {
  const base = iccUrl.replace(/\/+$/, '')
  const url = appId
    ? `${base}/control-plane/applications/${appId}/deploy/plan`
    : `${base}/control-plane/deploy/plan`
  const body = { image, version }
  if (hostname) body.hostname = hostname
  if (namespace) body.namespace = namespace
  if (minReplicas) body.minReplicas = minReplicas
  if (maxReplicas) body.maxReplicas = maxReplicas
  if (env && Object.keys(env).length) body.env = env
  return iccRequest(url, { method: 'POST', token, body })
}

// Read-only: the actuation plan for an EXISTING version, derived from its state
// (activate for pending-apply/staged, expire for draining). Returns { intent, steps }.
export async function getActuationPlan ({ iccUrl, appId, token, version }) {
  const base = iccUrl.replace(/\/+$/, '')
  const v = encodeURIComponent(version)
  const url = appId
    ? `${base}/control-plane/applications/${appId}/versions/${v}/actuation-plan`
    : `${base}/control-plane/versions/${v}/actuation-plan`
  return iccRequest(url, { method: 'GET', token })
}

// Write the plan's manifests to the run dir and print the kubectl commands to
// apply it. Applies nothing -- the operator (or their CI) runs these. Manifest
// steps become `kubectl apply -f <file>`; command-only steps (e.g. scale) print
// their command verbatim.
export async function writeAndPrintPlan (context, namespace, steps, { intent } = {}) {
  if (!steps || steps.length === 0) {
    info(`\nICC returned no steps${intent ? ` (intent: ${intent})` : ''}. Nothing to apply.`)
    return []
  }
  info(`\nICC returned a ${steps.length}-step plan${intent ? ` (intent: ${intent})` : ''}. ICC applied nothing.`)
  const applyCommands = []
  let i = 0
  for (const step of steps) {
    i++
    const name = step.manifest?.metadata?.name ?? step.kind
    const desc = step.description ? ` -- ${step.description}` : ''
    info(`  ${i}. ${step.kind}/${step.action}  ${name}${desc}`)
    if (step.manifest) {
      const filePath = await addToRun(context.runDir, `icc-${step.kind}-${name}.json`, JSON.stringify(step.manifest, null, 2))
      applyCommands.push(`kubectl --namespace=${namespace} apply --filename=${filePath}`)
    } else if (step.command) {
      applyCommands.push(step.command)
    }
  }
  info('\nApply it yourself with kubectl:')
  for (const cmd of applyCommands) info(`  ${cmd}`)
  return applyCommands
}
