#!/usr/bin/env node

import { randomBytes } from 'node:crypto'

const count = parseInt(process.argv[2])

if (isNaN(count) || count <= 0) {
  process.exit(1)
}

for (let i = 0; i < count; i++) {
  console.log(randomBytes(32).toString('base64'))
}
