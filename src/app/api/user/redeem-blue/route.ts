import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import prisma from '@/lib/prisma';

const SUPABASE_URL = process.env.BLUE_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.BLUE_SUPABASE_SERVICE_KEY!;

async function getSupabaseUserIdByEmail(email: string): Promise<string | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      }
    });

    if (!res.ok) {
      console.error('Supabase GoTrue API failed:', await res.text());
      return null;
    }

    const data = await res.json();
    const users = data.users || data || [];
    const matched = users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    return matched ? matched.id : null;
  } catch (err) {
    console.error('Failed to resolve Supabase user by email:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Access Denied: Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Retrieve user details from Imergene
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
      select: { email: true, imrBalance: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.imrBalance < 100) {
      return NextResponse.json({ error: 'Insufficient IMR balance. You need at least 100 IMR.' }, { status: 400 });
    }

    // 1. Resolve matching account on Blue by email
    const supabaseUserId = await getSupabaseUserIdByEmail(user.email);
    if (!supabaseUserId) {
      return NextResponse.json({ 
        error: `Account not found in Blue for email "${user.email}". Please register in the Blue Developer Portal first using this same email address!` 
      }, { status: 404 });
    }

    // 2. Debit 100 IMR from Imergene account
    await prisma.user.update({
      where: { id: payload.id },
      data: {
        imrBalance: {
          decrement: 100,
        },
      },
    });

    // 3. Credit Blue wallet in Supabase
    let success = false;
    let walletResponseText = '';
    try {
      // Query current balance in Blue
      const balanceRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${supabaseUserId}`, {
        headers: {
          'apikey': SUPABASE_SERVICE_KEY,
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        }
      });

      let currentBalance = 0;
      let walletRecordExists = false;

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json();
        if (balanceData && balanceData.length > 0) {
          currentBalance = Number(balanceData[0].balance || 0);
          walletRecordExists = true;
        }
      }

      // credit 100 IMR
      const updatedBalance = currentBalance + 100;

      if (walletRecordExists) {
        // Update current wallet
        const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets?user_id=eq.${supabaseUserId}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ balance: updatedBalance }),
        });
        success = updateRes.ok;
        walletResponseText = await updateRes.text();
      } else {
        // Create initial wallet
        const createRes = await fetch(`${SUPABASE_URL}/rest/v1/wallets`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: supabaseUserId, balance: updatedBalance }),
        });
        success = createRes.ok;
        walletResponseText = await createRes.text();
      }

      // Log transaction audit details in Blue
      if (success) {
        await fetch(`${SUPABASE_URL}/rest/v1/billing_transactions`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_SERVICE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: supabaseUserId,
            model: 'IMR Promotion Exchange',
            cost: -100, // Negative cost credits the account
            prompt_tokens: 0,
            completion_tokens: 0,
          }),
        }).catch(err => console.error('Failed to write transaction audit log in Blue:', err));
      }

    } catch (dbErr: any) {
      console.error('Blue database wallet update error:', dbErr);
      // Rollback IMR deduction on Imergene
      await prisma.user.update({
        where: { id: payload.id },
        data: {
          imrBalance: {
            increment: 100,
          },
        },
      });
      return NextResponse.json({ error: 'Blue wallet update failed: ' + dbErr.message }, { status: 500 });
    }

    if (!success) {
      // Rollback IMR deduction on Imergene
      await prisma.user.update({
        where: { id: payload.id },
        data: {
          imrBalance: {
            increment: 100,
          },
        },
      });
      console.error('Wallet update failed with response:', walletResponseText);
      return NextResponse.json({ error: 'Failed to credit Blue wallet balance' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully exchanged 100 IMR for $2.00 of Blue credits!',
    });

  } catch (err: any) {
    console.error('Redeem blue error:', err);
    return NextResponse.json({ error: err.message || 'Redemption process failed' }, { status: 500 });
  }
}
