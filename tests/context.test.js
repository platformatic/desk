import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import yaml from 'js-yaml'
import { loadContext } from '../lib/context.js'

test('loadContext should correctly load and combine profile and base configurations', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desk-'))

  process.env.DESK_PROFILE_PATH = join(tempDir, 'test-profile.yaml')

  const mockProfileConfig = { version: 4, cluster: {}, infra: {}, platformatic: {} }

  await writeFile(process.env.DESK_PROFILE_PATH, yaml.dump(mockProfileConfig))

  try {
    const result = await loadContext('test')

    assert.deepEqual(result, { ...mockProfileConfig })
  } finally {
    // await rm(join('charts', 'vtest'), { recursive: true, force: true })

    delete process.env.DESK_PROFILE_PATH
  }
})
