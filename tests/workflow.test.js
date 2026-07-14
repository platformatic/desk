import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import dotenv from 'dotenv'
import { detectWorkflow } from '../lib/workflow.js'

test('detectWorkflow recognizes Dockerfile ENV declaration forms', () => {
  assert.equal(detectWorkflow('ENV PLT_WORKFLOW=true'), true)
  assert.equal(detectWorkflow('ENV PLT_WORKFLOW true'), true)
})

test('detectWorkflow treats explicit false as authoritative', () => {
  assert.equal(detectWorkflow('ENV PLT_WORKFLOW=false\nENV WORKFLOW_TARGET_WORLD=@platformatic/world'), false)
  assert.equal(detectWorkflow('ENV PLT_WORKFLOW=true', { PLT_WORKFLOW: 'false' }), false)
})

test('detectWorkflow rejects invalid explicit values', () => {
  assert.throws(() => detectWorkflow('ENV PLT_WORKFLOW=yes'), /Invalid PLT_WORKFLOW value in Dockerfile ENV/)
  assert.throws(() => detectWorkflow('', { PLT_WORKFLOW: '1' }), /Invalid PLT_WORKFLOW value in environment file/)
})

test('detectWorkflow ignores comments and arbitrary text', () => {
  assert.equal(detectWorkflow('# ENV PLT_WORKFLOW=true\nRUN echo PLT_WORKFLOW=true'), false)
})

test('detectWorkflow does not classify a local world target', () => {
  assert.equal(detectWorkflow('ENV WORKFLOW_TARGET_WORLD=http://world.platformatic.svc.cluster.local'), false)
})

test('detectWorkflow supports the legacy managed world declaration', () => {
  assert.equal(detectWorkflow('ENV WORKFLOW_TARGET_WORLD=@platformatic/world'), true)
  assert.equal(detectWorkflow('ENV WORKFLOW_TARGET_WORLD @platformatic/world'), true)
})

test('detectWorkflow uses the final Dockerfile stage', () => {
  assert.equal(detectWorkflow(`
    FROM node AS builder
    ENV PLT_WORKFLOW=true
    FROM node AS runtime
  `), false)
  assert.equal(detectWorkflow(`
    FROM node AS builder
    ENV PLT_WORKFLOW=true
    FROM builder AS runtime
  `), true)
})

test('detectWorkflow classifies an image deployment from an env file', () => {
  assert.equal(detectWorkflow('', dotenv.parse('PLT_WORKFLOW=true\n')), true)
})

test('detectWorkflow rejects invalid image deployment env file declarations', () => {
  assert.throws(
    () => detectWorkflow('', dotenv.parse('PLT_WORKFLOW=invalid\n')),
    /Invalid PLT_WORKFLOW value in environment file/
  )
})
