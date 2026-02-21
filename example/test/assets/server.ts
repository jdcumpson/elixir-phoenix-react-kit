import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import express from 'express'
import { createServer as createViteServer, ViteDevServer } from 'vite'

const isProduction = process.env.NODE_ENV === 'production'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
let templateCache: string | null = null

function extractInlineModuleScripts(html: string) {
  const scripts: string[] = []
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null = null
  while ((match = scriptTag.exec(html)) !== null) {
    const attrs = match[1] ?? ''
    const body = match[2] ?? ''
    if (!/\btype\s*=\s*["']module["']/i.test(attrs)) continue
    if (/\bsrc\s*=/.test(attrs)) continue
    const trimmed = body.trim()
    if (trimmed.length === 0) continue
    scripts.push(trimmed)
  }
  return scripts
}

type ScriptTag = {
  raw: string
  attributes: Record<string, string | true>
  content: string
}

function extractScriptAttributes(attrs: string) {
  const attributes: Record<string, string | true> = {}
  const attributeMatcher =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null = null
  while ((match = attributeMatcher.exec(attrs)) !== null) {
    const key = (match[1] ?? '').toLowerCase()
    if (key.length === 0) continue
    const value = match[2] ?? match[3] ?? match[4]
    attributes[key] = value ?? true
  }
  return attributes
}

function extractScriptTags(html: string) {
  const scripts: ScriptTag[] = []
  const scriptTag = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null = null
  while ((match = scriptTag.exec(html)) !== null) {
    const raw = (match[0] ?? '').trim()
    if (raw.length === 0) continue
    scripts.push({
      raw,
      attributes: extractScriptAttributes(match[1] ?? ''),
      content: (match[2] ?? '').trim(),
    })
  }
  return scripts
}

async function watchStdin() {
  process.stdin.resume()
  process.stdin.setEncoding('utf8')

  for await (const chunk of process.stdin) {
    console.log(`[stdin] ${chunk.trim()}`)
  }

  process.exit(0)
}
let vite: ViteDevServer

const templateHtml = isProduction
  ? await fs.readFile('./dist/client/index.html', 'utf-8')
  : ''

async function createServer() {
  const app = express()

  // Create Vite server in middleware mode and configure the app type as
  // 'custom', disabling Vite's own HTML serving logic so parent server
  // can take control
  if (!isProduction) {
    vite = await createViteServer({
      root: __dirname,
      configFile: path.resolve(__dirname, 'vite.config.js'),
      mode: 'development',
      server: { middlewareMode: true },
      appType: 'custom',
    })
    app.use(vite.middlewares)
  } else {
    const sirv = (await import('sirv')).default
    app.use('/', sirv('./dist/client', { extensions: [] }))
  }

  // Use vite's connect instance as middleware. If you use your own
  // express router (express.Router()), you should use router.use
  // When the server restarts (for example after the user modifies
  // vite.config.js), `vite.middlewares` is still going to be the same
  // reference (with a new internal stack of Vite and plugin-injected
  // middlewares). The following is valid even after restarts.

  app.use('*all', async (request, response, next) => {
    if (!isProduction) {
      try {
        if (templateCache == null) {
          templateCache = await fs.readFile(
            path.resolve(__dirname, 'index.html'),
            'utf-8',
          )
        }
        let template = await vite.transformIndexHtml(
          request.originalUrl,
          templateCache,
          request.originalUrl,
        )
        template = template.replace(
          '"/@react-refresh"',
          '"http://localhost:4100/@react-refresh"',
        )
        const inlineModuleScripts = extractInlineModuleScripts(template)
        const scriptTags = extractScriptTags(template)
        const { render } = await vite.ssrLoadModule('/src/entry.server.tsx')
        await render(request, response, inlineModuleScripts, scriptTags, {
          env: 'dev',
        })
      } catch (e) {
        if (e instanceof Error) {
          vite.ssrFixStacktrace(e)
        }
        next(e)
      }
    } else {
      const template = templateHtml
      const inlineModuleScripts = extractInlineModuleScripts(template)
      const scriptTags = extractScriptTags(template)
      const render = (await import('./dist/server/entry.server.js')).render
      await render(request, response, inlineModuleScripts, scriptTags, {
        env: 'prod',
      })
    }
  })

  const port = 4100
  watchStdin()
  app.listen(port)
  console.info(`Starting Vite server on port ${port}`)
}

createServer()
