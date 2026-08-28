import bodyParser from 'body-parser'
const jsonBodyParser = bodyParser.json()

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function parseJsonBody(req, res) {
  return new Promise((resolve, reject) => {
    jsonBodyParser(req, res, (err) => {
      if (err) {
        reject(err)
        return
      }
      resolve(req.body || {})
    })
  })
}

export const mockEndpoints = [
  {
    path: '/user/ad',
    methods: ['POST'],
    handler(req, res, { body }) {
      const login = typeof body.login === 'string' ? body.login : ''
      sendJson(res, 200, {
        ad_login: login,
        ad_cn: 'Mock User',
        ad_title: 'Mock Title',
        ad_department: 'Mock Department',
      })
    },
  }
]

export function mockApiPlugin(endpoints = mockEndpoints) {
  return {
    name: 'mock-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`)
        const requestPath = url.pathname

        const endpoint = endpoints.find((e) => e.path === requestPath)

        if (!endpoint) {
          return next()
        }

        if (req.method === 'OPTIONS') {
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': `${endpoint.methods.join(', ')}, OPTIONS`,
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            Allow: `${endpoint.methods.join(', ')}, OPTIONS`,
          })
          res.end(JSON.stringify({ ok: true }))
          return
        }

        if (!endpoint.methods.includes(req.method)) {
          sendJson(res, 405, { error: `Only ${endpoint.methods.join('/')} are supported` })
          return
        }

        let body = {}
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          try {
            body = await parseJsonBody(req, res)
          } catch {
            sendJson(res, 400, { error: 'Invalid JSON body' })
            return
          }
        }

        endpoint.handler(req, res, { body })
      })
    },
  }
}
