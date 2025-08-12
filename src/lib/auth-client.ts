import { AuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compare } from 'bcryptjs';
import prisma from '@/lib/prisma';
import { Role } from '@prisma/client';

export const authOptions: AuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email }
        });

        if (!user || (!user.password && !user.passwordHash)) {
          return null;
        }

        const hashedPassword = user.password || user.passwordHash || '';
        const isPasswordValid = await compare(credentials.password, hashedPassword);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name || user.username || '',
          role: user.role,
          image: user.image || null
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
};

/**
 * Server-side sign in function
 */
export async function signIn(
  provider: string,
  credentials: { email: string; password: string; redirect?: boolean }
) {
  if (provider !== 'credentials') {
    throw new Error('Only credentials provider is supported');
  }

  const user = await prisma.user.findUnique({
    where: { email: credentials.email }
  });

  if (!user || (!user.password && !user.passwordHash)) {
    return { error: 'CredentialsSignin' };
  }

  const hashedPassword = user.password || user.passwordHash || '';
  const isPasswordValid = await compare(credentials.password, hashedPassword);

  if (!isPasswordValid) {
    return { error: 'CredentialsSignin' };
  }

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() }
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      userId: user.id,
      action: 'LOGIN',
      metadata: {
        ip: 'server-action',
        userAgent: 'server-action'
      }
    }
  });

  return {
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name || user.username || '',
      role: user.role,
      image: user.image || null
    }
  };
}

/**
 * Server-side sign out function
 */
export async function signOut(_options?: { redirect?: boolean }) {
  // Server Actions don't have access to cookies directly
  // This needs to be handled by the client
  return { success: true };
}