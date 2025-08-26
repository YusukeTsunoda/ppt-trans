'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export async function login(formData: FormData) {
  const validatedFields = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  
  if (!validatedFields.success) {
    return { success: false, message: 'Invalid input' };
  }
  
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(validatedFields.data);
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return { success: true, message: 'Login successful' };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return { success: true };
}

export async function resetPassword(formData: FormData | string) {
  const email = typeof formData === 'string' ? formData : formData.get('email') as string;
  
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return { success: true, message: 'Password reset email sent' };
}

// エイリアス for backward compatibility
export const loginAction = login;
export const logoutAction = logout;
export const forgotPasswordAction = resetPassword;

export async function signupAction(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
  });
  
  if (error) {
    return { success: false, message: error.message };
  }
  
  return { success: true, message: 'Signup successful' };
}

// Alias for backward compatibility
export const signUpAction = signupAction;