import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createDeployment, resourceVersion } from '../lib/deploy.js'
import { imageName, deployBuildArgs, generateVersion, skewProtectionEnabled } from '../cli/deploy.js'

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

test('--version reaches the image build as PLT_DEPLOYMENT_ID', () => {
  // The value has to land in three places at once: the build arg (so the client
  // assets carry ?dpl=<id>), the plt.dev/version label, and therefore the
  // gateway's match key. This covers the build-arg half; the label half is
  // asserted by the createDeployment tests above.
  assert.deepEqual(deployBuildArgs('v2'), { PLT_DEPLOYMENT_ID: 'v2' })
  assert.deepEqual(deployBuildArgs('a1b2c3d4e5f6'), { PLT_DEPLOYMENT_ID: 'a1b2c3d4e5f6' })
})

test('a deploy without --version passes no build args', () => {
  // Unversioned deploys must build exactly as before. Passing an empty
  // PLT_DEPLOYMENT_ID would make the framework hooks stamp `?dpl=` on every
  // asset URL, which matches nothing.
  assert.deepEqual(deployBuildArgs(undefined), {})
  assert.deepEqual(deployBuildArgs(null), {})
  assert.deepEqual(deployBuildArgs(''), {})
})

test('a generated version matches the plt_ convention and is a legal label value', () => {
  // Same shape ICC mints: `plt_` + 24 base62. base62 is alphanumeric only, so the
  // id always starts and ends alphanumeric -- which is what a k8s label value
  // requires, and what the `dpl_<base64url>` shape used on ECS cannot promise
  // (its tail can land on `-` or `_`).
  const labelValue = /^[A-Za-z0-9](?:[-A-Za-z0-9_.]{0,61}[A-Za-z0-9])?$/

  for (let i = 0; i < 200; i++) {
    const version = generateVersion(`registry/app:${i}`)
    assert.match(version, /^plt_[0-9A-Za-z]{24}$/, `${version} is not plt_ + 24 base62`)
    assert.match(version, labelValue, `${version} is not a valid label value`)
  }
})

test('a generated version is derived from the image reference', () => {
  // Deterministic per tag: the same build produces the same id. desk's tag
  // carries a timestamp, so consecutive deploys still get distinct versions.
  assert.equal(generateVersion('registry/app:123'), generateVersion('registry/app:123'))
  assert.notEqual(generateVersion('registry/app:123'), generateVersion('registry/app:124'))
})

test('a generated version does not become the resource name', () => {
  // The plt_ shape is a legal label value but NOT a legal resource name: the API
  // server rejects the underscore and the capitals. The name must fall back to
  // the image tag while plt.dev/version keeps the generated id.
  const version = generateVersion('plt.localreg/plt-local/orders:1786546018096')
  assert.equal(resourceVersion(version, 'plt.localreg/plt-local/orders:1786546018096'), '1786546018096')
  // An explicit --version that IS a legal segment is still used verbatim.
  assert.equal(resourceVersion('v1.2.3', 'registry/orders:abc'), 'v1.2.3')
})

test('skew protection is read from the profile', () => {
  const on = { platformatic: { services: { icc: { features: { skew_protection: { enable: true } } } } } }
  const off = { platformatic: { services: { icc: { features: { skew_protection: { enable: false } } } } } }

  assert.equal(skewProtectionEnabled(on), true)
  assert.equal(skewProtectionEnabled(off), false)
  // A profile that never mentions the feature must not deploy versioned
  // workloads: the deploy would name versions ICC is not tracking.
  assert.equal(skewProtectionEnabled({ platformatic: { services: { icc: {} } } }), false)
  assert.equal(skewProtectionEnabled({}), false)
  assert.equal(skewProtectionEnabled(undefined), false)
})

test('a generated version reaches the image build', () => {
  // The generated value is only useful if it is baked in: skipping the build arg
  // would produce a version label whose assets carry no matching ?dpl.
  const version = generateVersion('plt.localreg/plt-local/orders:1786546018096')
  assert.deepEqual(deployBuildArgs(version), { PLT_DEPLOYMENT_ID: version })
})
