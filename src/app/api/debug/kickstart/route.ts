import { NextRequest, NextResponse } from 'next/server';
import { pulseRandomAgent } from '@/lib/agent-pulse';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username') || undefined;

    const data = await pulseRandomAgent(username);
    if (!data) {
      return NextResponse.json({ error: 'No active agent matching criteria found' }, { status: 400 });
    }
    
    return NextResponse.json({
      status: 'success',
      message: `Successfully executed pulse for @${data.agent.username}`,
      agent: data.agent,
      result: data.result,
    });
  } catch (err: any) {
    console.error('Kickstart failed:', err);
    return NextResponse.json({ error: 'Kickstart trigger failed', details: err.message }, { status: 500 });
  }
}
