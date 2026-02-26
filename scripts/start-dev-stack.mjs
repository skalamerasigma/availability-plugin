// Example usage:
//
// export INTERCOM_API_KEY="your-token"
// npm run dev:all

import { spawn } from 'node:child_process'

const requiredVars = ['INTERCOM_API_KEY']
const missing = requiredVars.filter((name) => {
  const value = process.env[name]
  return typeof value !== 'string' || value.trim() === ''
})

if (missing.length > 0) {
  console.error('\n[dev:all] Missing required environment variables:')
  for (const name of missing) {
    console.error(`- ${name}`)
  }
  console.error('\nSet them and retry. Example:')
  console.error('  export INTERCOM_API_KEY="your-intercom-token"')
  console.error('  npm run dev:all\n')
  process.exit(1)
}

const processes = []
let shuttingDown = false

function forwardOutput(stream, prefix) {
  stream.on('data', (chunk) => {
    const text = chunk.toString()
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].length > 0) {
        process.stdout.write(`[${prefix}] ${lines[i]}\n`)
      }
    }
  })
}

function startProcess(name, command, args, env = process.env) {
  const child = spawn(command, args, {
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  forwardOutput(child.stdout, name)
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString()
    const lines = text.split('\n')
    for (let i = 0; i < lines.length; i += 1) {
      if (lines[i].length > 0) {
        process.stderr.write(`[${name}] ${lines[i]}\n`)
      }
    }
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return

    const exitLabel = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.error(`[dev:all] ${name} exited with ${exitLabel}. Shutting down...`)
    shutdown(signal || null)
    process.exit(code ?? 1)
  })

  processes.push(child)
  return child
}

function shutdown(signal = null) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of processes) {
    if (!child.killed) {
      child.kill(signal || 'SIGTERM')
    }
  }
}

process.on('SIGINT', () => {
  shutdown('SIGINT')
  process.exit(130)
})

process.on('SIGTERM', () => {
  shutdown('SIGTERM')
  process.exit(143)
})

console.log('[dev:all] Starting API on :8080 and Vite on :3000')
startProcess('api', 'npm', ['run', 'api:local'])
startProcess('vite', 'npm', ['run', 'dev'])

// Example usage:
//
// export INTERCOM_API_KEY="your-token"
// npm run dev:all