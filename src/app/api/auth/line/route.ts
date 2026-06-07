import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const returnTo = req.nextUrl.searchParams.get('returnTo') || '/';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.LINE_CHANNEL_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
    state: encodeURIComponent(returnTo), // use state to carry returnT