import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';

export async function POST(request: NextRequest) {
  try {
    const { email, password, callbackUrl } = await request.json();
    
    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: callbackUrl || '/'
    });
    
    return NextResponse.json(result);
  } catch (_error) {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 }
    );
  }
}