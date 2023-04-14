import { NextResponse } from 'next/server'
import type { NextFetchEvent, NextRequest } from 'next/server'

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  return NextResponse.next()
}