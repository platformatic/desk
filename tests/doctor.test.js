import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { assertEbpfSandboxSupport } from '../lib/doctor.js'

test('assertEbpfSandboxSupport rejects non-linux platforms', async () => {
  await assert.rejects(
    assertEbpfSandboxSupport({
      platform: 'darwin',
      readFileFn: async () => 'lockdown,yama,integrity,bpf'
    }),
    /not supported on macOS or Windows/
  )
})

test('assertEbpfSandboxSupport rejects linux hosts without active BPF LSM', async () => {
  await assert.rejects(
    assertEbpfSandboxSupport({
      platform: 'linux',
      readFileFn: async () => 'capability,landlock,lockdown,yama,integrity,apparmor'
    }),
    /BPF LSM is not active/
  )
})

test('assertEbpfSandboxSupport accepts linux hosts with active BPF LSM', async () => {
  await assert.doesNotReject(async () => {
    await assertEbpfSandboxSupport({
      platform: 'linux',
      readFileFn: async () => 'capability,landlock,lockdown,yama,integrity,apparmor,bpf'
    })
  })
})
