import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDeployment } from '../lib/deploy.js'
import { imageName } from '../cli/deploy.js'

test('imageName handles registry ports, tags, and digests', () => {
  assert.equal(imageName('localhost:5000/orders:v2'), 'orders')
  assert.equal(imageName('registry.example/orders@sha256:abc'), 'orders')
})

test('workflow deployment has authoritative world metadata', async () => {
  const runDir = await mkdtemp(join(tmpdir(), 'desk-deploy-'))

  try {
    await createDeployment('orders', 'registry/orders:v2', 'platformatic', {
      PLT_INSTANCE_ID: 'overridden',
      PLT_DEPLOYMENT_VERSION: 'overridden',
      PLT_WORLD_APP_ID: 'wrong-app',
      PLT_WORLD_DEPLOYMENT_VERSION: 'wrong-version',
      USER_ENV: 'preserved'
    }, true, {
      context: { runDir },
      version: 'v2',
      isWorkflow: true
    })

    const manifest = JSON.parse(await readFile(join(runDir, 'deployment.json'), 'utf8'))
    const env = manifest.spec.template.spec.containers[0].env
    assert.deepEqual(manifest.metadata.labels, {
      'app.kubernetes.io/name': 'orders',
      'app.kubernetes.io/instance': 'orders-v2',
      'plt.dev/version': 'v2',
      'plt.dev/workflow': 'true'
    })
    assert.equal(manifest.spec.template.metadata.labels['app.kubernetes.io/name'], 'orders')
    assert.deepEqual(env.filter(entry => entry.name === 'PLT_WORLD_APP_ID'), [
      { name: 'PLT_WORLD_APP_ID', value: manifest.metadata.labels['app.kubernetes.io/name'] }
    ])
    assert.deepEqual(env.filter(entry => entry.name === 'PLT_WORLD_DEPLOYMENT_VERSION'), [
      { name: 'PLT_WORLD_DEPLOYMENT_VERSION', value: 'v2' }
    ])
    assert.equal(env.find(entry => entry.name === 'USER_ENV').value, 'preserved')
    assert.equal(env.filter(entry => entry.name === 'PLT_INSTANCE_ID').length, 1)
    assert.equal(env.some(entry => entry.name === 'PLT_DEPLOYMENT_VERSION'), false)
  } finally {
    await rm(runDir, { recursive: true, force: true })
  }
})
