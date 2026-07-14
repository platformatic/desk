import { strict as assert } from 'node:assert'
import { afterEach, test } from 'node:test'
import { deployViaIcc } from '../lib/icc.js'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

test('deployViaIcc sends workflow expiry policy', async () => {
  let request
  globalThis.fetch = async (url, options) => {
    request = { url, options }
    return { ok: true, text: async () => '{"deployed":true}' }
  }

  await deployViaIcc({
    iccUrl: 'https://icc.plt',
    token: 'token',
    image: 'registry/orders:v2',
    version: 'v2',
    expirePolicy: 'workflow'
  })

  assert.equal(request.url, 'https://icc.plt/control-plane/deploy')
  assert.equal(JSON.parse(request.options.body).expirePolicy, 'workflow')
})

test('deployViaIcc omits expiry policy for non-workflow deployments', async () => {
  let body
  globalThis.fetch = async (url, options) => {
    body = JSON.parse(options.body)
    return { ok: true, text: async () => '{"deployed":true}' }
  }

  await deployViaIcc({
    iccUrl: 'https://icc.plt',
    token: 'token',
    image: 'registry/orders:v2',
    version: 'v2'
  })

  assert.equal(Object.hasOwn(body, 'expirePolicy'), false)
})
