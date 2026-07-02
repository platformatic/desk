import { addToRun } from './run-directory.js'
import { spawn, info, warn } from './utils.js'

// Drive a deploy through ICC's deploy API instead of templating + applying the
// workload directly. Lets you exercise the skew-protection actuation modes:
//   manage -> ICC creates the Deployment + Service itself (nothing to apply here)
//   advise -> ICC returns the manifests as a plan; desk applies them (below)
//   observe -> ICC rejects the deploy API (you create workloads yourself)
//
// Auth is a scoped deploy token (Bearer plt_deploy_...), the same CI path a
// customer would use. icc.plt uses a local/self-signed cert, so TLS verification
// is disabled for this call (dev/testing tool).
export async function deployViaIcc ({ iccUrl, appId, token, image, version, hostname, namespace, minReplicas, maxReplicas, env }) {
  const url = `${iccUrl.replace(/\/+$/, '')}/control-plane/applications/${appId}/deploy`

  const body = { image, version }
  if (hostname) body.hostname = hostname
  if (namespace) body.namespace = namespace
  if (minReplicas) body.minReplicas = minReplicas
  if (maxReplicas) body.maxReplicas = maxReplicas
  if (env && Object.keys(env).length) body.env = env

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

// Apply the manifests from an advise-mode plan via kubectl (the external actor's
// job). Each step's manifest is written to the run dir and applied.
export async function applyIccPlan (context, namespace, plan, dryRun) {
  let applied = 0
  for (const step of plan) {
    if (!step.manifest) continue
    const name = step.manifest?.metadata?.name ?? `${step.kind ?? 'resource'}-${applied}`
    info(`  plan: ${step.kind}/${step.action} ${name}`)
    if (step.command) info(`        ${step.command}`)
    if (dryRun) { applied++; continue }
    const filePath = await addToRun(context.runDir, `icc-${step.kind}-${name}.json`, JSON.stringify(step.manifest))
    await spawn('kubectl', [`--namespace=${namespace}`, 'apply', `--filename=${filePath}`])
    applied++
  }
  return applied
}

// Report the outcome of an ICC deploy and, in advise mode, apply the plan.
export async function handleIccDeploy (context, namespace, result, dryRun) {
  if (result.deployed) {
    info('\nManage mode: ICC created the Deployment + Service. Pods will register and the version will go active.')
    return
  }
  const plan = result.plan ?? []
  if (result.pendingApply || plan.length > 0) {
    info(`\nAdvise mode: ICC returned a ${plan.length}-step plan. Applying it now (external actor):`)
    const applied = await applyIccPlan(context, namespace, plan, dryRun)
    info(`\nApplied ${applied} manifest(s). ICC confirms the version active once pods register and the gateway route is Accepted.`)
    return
  }
  warn('ICC deploy returned no plan and deployed=false; nothing to do.')
}
