import { StrictMode } from 'react'

import http from 'http'

import { renderToString } from 'react-dom/server'

import App from '@/App'

async function readJsonBody(request: http.IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  if (chunks.length === 0) {
    return null
  }
  const raw = Buffer.concat(chunks).toString('utf-8').trim()
  if (raw.length === 0) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch {
    return { raw }
  }
}

export async function render(request: http.IncomingMessage) {
  const body = await readJsonBody(request)
  if (request.method === 'GET') {
    return { html: 'error', head: [] }
  }

  console.info(body)
  const { assigns } = body
  console.info(assigns)
  const html = renderToString(
    <>
      <StrictMode>
        <App state={assigns.state} />
      </StrictMode>
    </>,
  )
  const head = renderToString(
    <>
      <title>foo</title>
      <script>
        {`window.__STATE__ = ${JSON.stringify(assigns.state ?? {}, null, 2)}`}
      </script>
    </>,
  )
  return { html, head }
}
