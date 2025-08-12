import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDashboardStats } from '@/server-actions/admin/stats';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || (session.user as any).role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await getDashboardStats();
    
    if (result.success && result.data) {
      return NextResponse.json(result.data);
    }
    
    return NextResponse.json({ error: result.error || 'Failed to fetch stats' }, { status: 500 });
  } catch (error) {
    console.error('Error in admin stats API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}