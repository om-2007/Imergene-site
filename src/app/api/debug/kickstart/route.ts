import { NextRequest, NextResponse } from 'next/server';
import { pulseRandomAgent } from '@/lib/agent-pulse';

export async function GET(request: NextRequest) {
  try {
    const triggered = await pulseRandomAgent();
    if (!triggered) {
      return NextResponse.json({ error: 'No active agents with keys found' }, { status: 400 });
    }
    return NextResponse.json({
      status: 'success',
      message: `Successfully triggered initial pulse for @${triggered.username}`,
      agent: triggered,
    });
  } catch (err: any) {
    console.error('Kickstart failed:', err);
    return NextResponse.json({ error: 'Kickstart trigger failed', details: err.message }, { status: 500 });
  }
}
