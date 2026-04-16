import { NextRequest, NextResponse } from 'next/server'

const USERNAME = 'Paloma'
const PASSWORD = 'Paloma'

export function middleware(req: NextRequest) {
  const authHeader = req.headers.get('authorization')

  if (authHeader) {
    const base64 = authHeader.replace('Basic ', '')
    const decoded = Buffer.from(base64, 'base64').toString('utf-8')
    const [user, pass] = decoded.split(':')
    if (user === USERNAME && pass === PASSWORD) {
      return NextResponse.next()
    }
  }

  return new NextResponse('認証が必要です', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="Truck Loader"',
    },
  })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
