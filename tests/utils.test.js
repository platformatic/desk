import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { loadYamlFile } from '../lib/utils.js'

const profile = `
notifications:
  enable: false
  email:
    from: "{{ SMTP_USER }}"
    recipients: ["{{ EMAIL_TO }}"]
  slack:
    channel: "{{ SLACK_CHANNEL }}"
repo: "{{ ICC_REPO }}"
`

async function withFile (content, fn) {
  const dir = await mkdtemp(join(tmpdir(), 'desk-yaml-'))
  try {
    const file = join(dir, 'profile.yaml')
    await writeFile(file, content)
    return await fn(file)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('placeholders without a value are kept by default', async () => {
  await withFile(profile, async file => {
    const result = await loadYamlFile(file, { ICC_REPO: '/work/icc' })
    assert.equal(result.repo, '/work/icc')
    assert.deepEqual(result.notifications.email.recipients, ['{{ EMAIL_TO }}'])
  })
})

test('with missing: empty, placeholders without a value become empty strings and are reported', async () => {
  await withFile(profile, async file => {
    let reported
    const result = await loadYamlFile(file, { ICC_REPO: '/work/icc', SMTP_USER: 'me@example.com' }, {
      missing: 'empty',
      onMissing: names => { reported = names }
    })
    assert.equal(result.repo, '/work/icc')
    assert.equal(result.notifications.email.from, 'me@example.com')
    assert.deepEqual(result.notifications.email.recipients, [''])
    assert.equal(result.notifications.slack.channel, '')
    assert.deepEqual(reported.sort(), ['EMAIL_TO', 'SLACK_CHANNEL'])
  })
})

test('nothing is reported when every placeholder has a value', async () => {
  await withFile('a: "{{ A }}"\n', async file => {
    let called = false
    const result = await loadYamlFile(file, { A: 'x' }, { missing: 'empty', onMissing: () => { called = true } })
    assert.equal(result.a, 'x')
    assert.equal(called, false)
  })
})
