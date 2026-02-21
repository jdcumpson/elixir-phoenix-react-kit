import { StrictMode } from 'react'

import http from 'http'
import { Transform } from 'node:stream'

import { Request, Response } from 'express'
import merge from 'lodash.merge'
import { renderToPipeableStream, renderToString } from 'react-dom/server'

import App from '@/App'
import ErrorPage from '@/domains/app/ErrorPage'
import { ApplicationState, DEFAULT_STATE } from '@/domains/app/redux'
import { NotFoundError } from '@/domains/app/router'
import { AppState, createStore } from '@/redux'

async function readJsonBody<T>(request: http.IncomingMessage) {
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
  return JSON.parse(raw) as T
}

function createInlineModuleInjector(scripts: string[]) {
  if (scripts.length === 0) {
    return null
  }

  const injection =
    scripts.map((code) => `<script type="module">${code}</script>`).join('') +
    '\n<script type="module" src="http://localhost:4100/@vite/client"></script>'

  let injected = false
  let tail = ''

  return new Transform({
    transform(chunk, _enc, cb) {
      const text = tail + chunk.toString('utf8')

      if (!injected) {
        const idx = text.indexOf('</head>')
        if (idx !== -1) {
          injected = true
          tail = ''
          this.push(text.slice(0, idx) + injection + text.slice(idx))
          cb()
          return
        }
      }

      const keep = 32
      if (text.length <= keep) {
        tail = text
        cb()
        return
      }
      tail = text.slice(-keep)
      this.push(text.slice(0, -keep))
      cb()
    },
    flush(cb) {
      if (tail != null && tail !== '') {
        this.push(tail)
      }
      cb()
    },
  })
}

export async function render(
  request: Request,
  response: Response,
  inlineModuleScripts: string[] = [],
) {
  response.setHeader('Content-Type', 'text/html')
  if (request.method === 'GET') {
    response.status(400).end('Bad Request')
  }
  const body = await readJsonBody<{ assigns: { state: Partial<AppState> } }>(
    request,
  )

  const defaultState = {
    application: {
      ...DEFAULT_STATE,
    },
  }
  const appState: Partial<ApplicationState> = {
    path: request.originalUrl,
  }
  const store = createStore(
    merge(
      {},
      defaultState,
      { application: appState },
      body?.assigns.state ?? {},
    ),
  )

  return new Promise((resolve) => {
    const finish = () => resolve(response)
    const { pipe, abort } = renderToPipeableStream(
      <>
        <StrictMode>
          <App store={store} />
        </StrictMode>
      </>,
      {
        bootstrapModules: [`http://localhost:4100/src/entry.client.tsx`],
        onShellReady: () => {
          response.status(
            store.getState().application.responseOptions?.status ?? 200,
          )
          const injector = createInlineModuleInjector(
            inlineModuleScripts.concat(
              `window.__STATE__ = ${JSON.stringify(store.getState(), null, 2)}`,
            ),
          )
          if (injector) {
            pipe(injector)
            injector.pipe(response)
          } else {
            pipe(response)
          }

          response.on('finish', finish)
        },
        onError(error, errorInfo) {
          response.off('finish', finish)
          if (response.writableFinished) {
            return
          }
          if (error instanceof Error) {
            let status = 500
            if (error instanceof NotFoundError) {
              status = 404
            } else {
              // TODO: implement logging levels for debugging
              console.error(
                'Error during SSR',
                error,
                errorInfo.componentStack,
                response.writableFinished,
              )
            }
            try {
              store.dispatch({
                type: 'application/routeResult',
                payload: {
                  status,
                  errorInfo: {
                    message: error.message,
                    stack: errorInfo.componentStack,
                  },
                },
              })
              const { pipe } = renderToPipeableStream(
                <StrictMode>
                  <App store={store} />
                </StrictMode>,
                {
                  bootstrapModules: [
                    `http://localhost:4100/src/entry.client.tsx`,
                  ],
                  onShellReady() {
                    response.status(status)
                    const injector = createInlineModuleInjector(
                      inlineModuleScripts.concat(
                        `window.__STATE__ = ${JSON.stringify(store.getState(), null, 2)}`,
                      ),
                    )
                    if (injector) {
                      pipe(injector)
                      injector.pipe(response)
                    } else {
                      pipe(response)
                    }

                    response.on('finish', () => {
                      resolve(response)
                    })
                  },
                },
              )
            } catch (e) {
              if (e instanceof Error) {
                response.end(
                  renderToString(
                    <html>
                      <ErrorPage
                        error={{
                          message: error.message,
                          stack: errorInfo.componentStack,
                        }}
                      />
                    </html>,
                  ),
                )
              } else {
                response.end(
                  renderToString(
                    <html>
                      <ErrorPage
                        error={{
                          message: String(e),
                          stack: errorInfo.componentStack,
                        }}
                      />
                    </html>,
                  ),
                )
              }
            }
          } else {
            console.error(
              'Error during SSR',
              error,
              errorInfo.componentStack,
              response.writableFinished,
            )
            response.end(error)
          }
        },
      },
    )
    setTimeout(() => {
      abort('Rendering took too long, timeout')
    }, 10000)
  })
}
