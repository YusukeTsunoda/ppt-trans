'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface ProfileState {
  error?: string;
  success?: boolean;
  message?: string;
}

// プロフィール更新アクション
export async function updateProfileAction(
  prevState: ProfileState | null,
  formData: FormData
): Promise<ProfileState> {
  try {
    const displayName = formData.get('displayName') as string;
    const bio = formData.get('bio') as string;
    
    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: '認証が必要です' };
    }

    // プロファイルデータの更新
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        display_name: displayName,
        bio: bio,
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Profile update error:', updateError);
      return { error: 'プロフィールの更新に失敗しました' };
    }

    revalidatePath('/profile');
    revalidatePath('/dashboard');

    return {
      success: true,
      message: 'プロフィールが更新されました'
    };

  } catch (error) {
    console.error('Profile action error:', error);
    return { error: 'プロフィールの更新に失敗しました' };
  }
}

// パスワード変更アクション
export async function changePasswordAction(
  prevState: ProfileState | null,
  formData: FormData
): Promise<ProfileState> {
  try {
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // バリデーション
    if (!currentPassword || !newPassword || !confirmPassword) {
      return { error: '全ての項目を入力してください' };
    }

    if (newPassword !== confirmPassword) {
      return { error: '新しいパスワードが一致しません' };
    }

    if (newPassword.length < 6) {
      return { error: 'パスワードは6文字以上で入力してください' };
    }

    const supabase = await createClient();
    
    // ユーザー認証の確認
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return { error: '認証が必要です' };
    }

    // パスワードの更新
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return { 
        error: updateError.message.includes('incorrect') 
          ? '現在のパスワードが正しくありません'
          : 'パスワードの更新に失敗しました'
      };
    }

    revalidatePath('/profile');
    
    return {
      success: true,
      message: 'パスワードが更新されました'
    };

  } catch (error) {
    console.error('Password change error:', error);
    return { error: 'パスワードの更新に失敗しました' };
  }
}