import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, readFile, rm, stat, symlink } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const targets = [
  { trace: 'processes/preview/page.js.nft.json', route: '/processes/preview', destination: '/processes', status: 308 },
  { trace: 'processes/preview/[id]/page.js.nft.json', route: '/processes/preview/get-paid', destination: '/processes/get-paid', status: 308 },
  { trace: 'processes/incorporate-c-corp/v2/page.js.nft.json', route: '/processes/incorporate-c-corp/v2', destination: '/processes/incorporate-c-corp', status: 308 },
]
const requiredFiles = ['processes/corpus.json', 'journeys/chains.json', 'processes/business-logic-map.json']

export async function readTraces(root) {
  return Promise.all(targets.map(async target => {
    const filename = path.join(root, '.next/server/app', target.trace)
    const manifest = JSON.parse(await readFile(filename, 'utf8'))
    return { ...target, files: new Set(manifest.files.map(file => path.resolve(path.dirname(filename), file))) }
  }))
}

export async function verifyTraces(root, traces) {
  for (const trace of traces) for (const file of requiredFiles) {
    const absolute = path.join(root, file)
    assert(trace.files.has(absolute), `${trace.route}: deployment trace omits ${file}`)
    assert((await stat(absolute)).isFile(), `${trace.route}: traced file is not a file: ${file}`)
  }
  console.log('Preview traces include required runtime data files for all three routes.')
}

// Static routes are fully prerendered (force-static, or generateStaticParams with
// dynamicParams=false), so their fs reads happen at build time only. next.config.ts's
// outputFileTracingExcludes keeps these build-time-only directories out of their deployment
// traces — the regression this guards is the one that ENOSPC'd Vercel's output packaging
// (10.17 GB of traced bytes before the excludes; see docs/BUILD-SIZE.md).
export const staticTargets = [
  { trace: 'page.js.nft.json', route: '/' },
  { trace: 'vs/[slug]/page.js.nft.json', route: '/vs/[slug]' },
  { trace: 'arena/[category]/product/[id]/page.js.nft.json', route: '/arena/[category]/product/[id]' },
  { trace: 'ops/page.js.nft.json', route: '/ops' },
  // The ⌘K palette index route (app/search-index.json/route.ts): force-static, so its
  // buildAllSearchEntries() fs reads happen at build time only and its deployment trace must
  // stay data-free like every other static route's.
  { trace: 'search-index.json/route.js.nft.json', route: '/search-index.json' },
  { trace: 'processes/[slug]/page.js.nft.json', route: '/processes/[slug]' },
]
const excludedDirs = ['data', 'public', 'pipeline', 'docs', 'content', 'processes', 'journeys', 'vendors']

export async function verifyStaticTraceExcludes(root) {
  for (const target of staticTargets) {
    const filename = path.join(root, '.next/server/app', target.trace)
    const manifest = JSON.parse(await readFile(filename, 'utf8'))
    for (const file of manifest.files) {
      const relative = path.relative(root, path.resolve(path.dirname(filename), file))
      const top = relative.split(path.sep)[0]
      assert(!excludedDirs.includes(top),
        `${target.route}: deployment trace still carries build-time-only file ${relative} — outputFileTracingExcludes regressed (docs/BUILD-SIZE.md)`)
    }
  }
  console.log(`Static traces carry no build-time-only directories (${staticTargets.length} routes checked).`)
}

async function unusedPort() {
  const server = createServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const port = server.address().port
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
  return port
}

export async function stopRuntime(child) {
  // A failed spawn has no PID and emits error/close, never exit. An already
  // signaled process also has no future exit event to wait for.
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const force = setTimeout(() => child.kill('SIGKILL'), 5_000)
  try { await exited } finally { clearTimeout(force) }
}

export async function smokeRuntime(root, traces) {
  const runtime = await mkdtemp(path.join(tmpdir(), 'preview-runtime-'))
  let child
  let logs = ''
  try {
    // The built server and installed packages are available. Repository data is
    // available ONLY when a preview trace lists it, never via a whole-root link.
    for (const name of ['.next', 'node_modules', 'package.json']) {
      await symlink(path.join(root, name), path.join(runtime, name))
    }
    const files = [...new Set(traces.flatMap(trace => [...trace.files]))]
    for (let offset = 0; offset < files.length; offset += 64) {
      await Promise.all(files.slice(offset, offset + 64).map(async file => {
        const relative = path.relative(root, file)
        if (relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return
        if (['.next', 'node_modules', 'package.json'].includes(relative.split(path.sep)[0])) return
        const destination = path.join(runtime, relative)
        await mkdir(path.dirname(destination), { recursive: true })
        await symlink(file, destination)
      }))
    }
    const port = await unusedPort()
    child = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: runtime,
      env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Packaged runtime did not start:\n${logs}`)), 30_000)
      const collect = chunk => {
        logs = (logs + chunk).slice(-20_000)
        if (logs.includes('Ready in')) { clearTimeout(timer); resolve() }
      }
      child.stdout.on('data', collect)
      child.stderr.on('data', collect)
      child.once('error', error => { clearTimeout(timer); reject(error) })
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Packaged runtime exited ${code}:\n${logs}`)) })
    })
    for (const target of [...targets,
      { route: '/processes/get-paid', marker: 'data-shared-record="get-paid"' },
      { route: '/processes/incorporate-c-corp', marker: 'data-shared-record="form_001"' },
      { route: '/processes/preview/form_001?via=legal-ops:clerky&via=payments:stripe&geo=IN&extra=a&extra=b', destination: '/processes/incorporate-c-corp', status: 308 },
      { route: '/processes/preview/unknown-runtime-smoke-route', status: 404 },
    ]) {
      const response = await fetch(`http://127.0.0.1:${port}${target.route}`, { signal: AbortSignal.timeout(30_000), redirect: 'manual' })
      const body = await response.text()
      assert.equal(response.status, target.status ?? 200, `${target.route}: unexpected status\n${logs}`)
      if (target.marker) assert(body.includes(target.marker), `${target.route}: missing rendered content\n${logs}`)
      if (target.destination) {
        const source = new URL(target.route, 'http://localhost')
        const destination = new URL(response.headers.get('location'), 'http://localhost')
        assert.equal(destination.pathname, target.destination)
        assert.deepEqual([...destination.searchParams], [...source.searchParams], `${target.route}: query values changed`)
      }
      console.log(`Packaged preview ${response.status}: ${target.route}`)
    }
    assert(!logs.includes('ENOENT'), `Packaged runtime accessed untraced files:\n${logs}`)
  } finally {
    await stopRuntime(child)
    await rm(runtime, { recursive: true, force: true })
  }
}

async function main() {
  const args = process.argv.slice(2)
  const rootFlag = args.indexOf('--root')
  const root = path.resolve(rootFlag === -1 ? process.cwd() : args[rootFlag + 1])
  const traces = await readTraces(root)
  await verifyTraces(root, traces)
  await verifyStaticTraceExcludes(root)
  if (!args.includes('--trace-only')) await smokeRuntime(root, traces)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1 })
}
