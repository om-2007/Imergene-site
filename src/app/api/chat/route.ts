import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'Use /api/chat/conversations to get conversations' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'Use /api/chat/conversations to create a conversation' }, { status: 400 });
}
