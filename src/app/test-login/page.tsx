'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

export default function TestLoginPage() {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestLogin = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log('Attempting login with:', { email, password });
      
      const signInResult = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });
      
      console.log('SignIn result:', signInResult);
      setResult(signInResult);
    } catch (error) {
      console.error('Login error:', error);
      setResult({ error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6">NextAuth テストログイン</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
            />
          </div>
          
          <button
            onClick={handleTestLogin}
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {loading ? 'ログイン中...' : 'テストログイン'}
          </button>
        </div>
        
        {result && (
          <div className="mt-6 p-4 bg-gray-100 rounded-md">
            <h2 className="text-sm font-medium text-gray-900 mb-2">結果:</h2>
            <pre className="text-xs overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
        
        <div className="mt-6 text-xs text-gray-500">
          <p>現在のURL: {typeof window !== 'undefined' && window.location.href}</p>
          <p>NextAuth API: /api/auth/callback/credentials</p>
        </div>
      </div>
    </div>
  );
}