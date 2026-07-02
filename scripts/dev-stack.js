import { spawn } from 'node:child_process'

const children = [
  spawn('npm', ['run', 'server'], { stdio: 'inherit', shell: true }),
  spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: true }),
]

function shutdown(signal) {
  for (const child of children) {
    if (!child.killed) {
      child.kill(signal)
    }
  }
}

for (const child of children) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM')
      process.exit(code)
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
