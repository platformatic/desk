import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import yaml from 'yaml'
import { loadContext } from '../lib/context.js'

test('loadContext should correctly load and combine profile and base configurations', async (t) => {
  const tempDir = await mkdtemp(join(tmpdir(), 'desk-'))

  const profilePath = join(tempDir, 'test-profile.yaml')
  process.env.DESK_PROFILE_DIR_PATH = tempDir

  const mockProfileConfig = {
    version: 4,
    cluster: {
      namespaces: [],
      k3d: { nodes: 1 }
    },
    dependencies: {},
    platformatic: {
      skip: true
    }
  }

  await writeFile(profilePath, yaml.stringify(mockProfileConfig))

  try {
    // Test loading by name
    const result = await loadContext('test-profile')
    assert.equal(result.name, 'test-profile')
    assert.equal(result.schemaVersion, 4)

    // Test loading by relative path
    const originalCwd = process.cwd()
    process.chdir(tempDir)
    const resultRelative = await loadContext('./test-profile.yaml')
    assert.equal(resultRelative.name, 'test-profile')
    assert.equal(resultRelative.schemaVersion, 4)
    process.chdir(originalCwd)

    // Test loading by absolute path
    const resultAbsolute = await loadContext(profilePath)
    assert.equal(resultAbsolute.name, 'test-profile')
    assert.equal(resultAbsolute.schemaVersion, 4)
  } finally {
    await rm(tempDir, { recursive: true, force: true })
    delete process.env.DESK_PROFILE_DIR_PATH
  }
})
