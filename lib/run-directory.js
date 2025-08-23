import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { debug } from './utils.js'

// get last run path
// write to last run dir

export async function createRunDir () {
  return mkdtemp(join(tmpdir(), 'plt-desk-'))
}

export async function addToRun (runDir, relativePath, content) {
  const finalPath = join(runDir, relativePath)

  debug(`Adding file: ${finalPath}`)
  await mkdir(dirname(finalPath), { recursive: true })
  await writeFile(finalPath, content)
  return finalPath
}

export async function readFromRun ({ context, relativePath }) {
}

export async function getLastRun () {
}
