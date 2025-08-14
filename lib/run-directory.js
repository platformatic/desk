import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// get last run path
// write to last run dir

export async function createRunDir () {
  return mkdtemp(join(tmpdir(), 'plt-desk-'))
}

export async function addToRun (runDir, relativePath, content) {
  const finalPath = join(runDir, relativePath) 
  await writeFile(finalPath, content)
  return finalPath
}

export async function readFromRun ({ context, relativePath }) {
}

export async function getLastRun () {
}
