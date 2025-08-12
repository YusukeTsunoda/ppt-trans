/**
 * メール送信ユーティリティ
 * 
 * Resend または SendGrid を使用してメールを送信
 */

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * メールを送信
 */
export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  const from = process.env.EMAIL_FROM || 'noreply@example.com';

  // Resend を使用する場合
  if (process.env.RESEND_API_KEY) {
    try {
      // Resend パッケージがインストールされている場合のみ使用
      let Resend: any;
      try {
        // @ts-expect-error - オプショナルなパッケージ
        const resendModule = await import('resend');
        Resend = resendModule.Resend;
      } catch {
        console.warn('Resend package not installed. Please install "resend" to use Resend email service.');
        return false;
      }
      
      const resend = new Resend(process.env.RESEND_API_KEY);

      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
        text,
      });

      if (error) {
        console.error('Resend error:', error);
        return false;
      }

      console.log('Email sent via Resend:', data);
      return true;
    } catch (error) {
      console.error('Failed to send email via Resend:', error);
      return false;
    }
  }

  // SendGrid を使用する場合
  if (process.env.SENDGRID_API_KEY) {
    try {
      // SendGrid パッケージがインストールされている場合のみ使用
      let sgMail: any;
      try {
        // @ts-expect-error - オプショナルなパッケージ
        sgMail = await import('@sendgrid/mail');
      } catch {
        console.warn('SendGrid package not installed. Please install "@sendgrid/mail" to use SendGrid email service.');
        return false;
      }
      
      sgMail.default.setApiKey(process.env.SENDGRID_API_KEY);

      await sgMail.default.send({
        to,
        from,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, ''), // HTMLタグを除去
      });

      console.log('Email sent via SendGrid');
      return true;
    } catch (error) {
      console.error('Failed to send email via SendGrid:', error);
      return false;
    }
  }

  // メールサービスが設定されていない場合（開発環境）
  if (process.env.NODE_ENV === 'development') {
    console.log('📧 Development Email:', {
      to,
      from,
      subject,
      preview: text?.substring(0, 100) || html.substring(0, 100),
    });
    return true;
  }

  console.warn('No email service configured');
  return false;
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${resetToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button { display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>パスワードリセット</h1>
          </div>
          <div class="content">
            <p>こんにちは、</p>
            <p>パスワードリセットのリクエストを受け付けました。以下のボタンをクリックして、新しいパスワードを設定してください。</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">パスワードをリセット</a>
            </div>
            <p>このリンクは24時間有効です。</p>
            <p>心当たりがない場合は、このメールを無視してください。</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              ボタンが機能しない場合は、以下のURLをブラウザに直接コピー＆ペーストしてください：<br>
              <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PPT Translator. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
パスワードリセット

パスワードリセットのリクエストを受け付けました。
以下のURLから新しいパスワードを設定してください：

${resetUrl}

このリンクは24時間有効です。
心当たりがない場合は、このメールを無視してください。

© 2024 PPT Translator
  `;

  return sendEmail({
    to: email,
    subject: 'パスワードリセットのご案内',
    html,
    text,
  });
}

/**
 * メールアドレス確認メールを送信
 */
export async function sendVerificationEmail(email: string, verificationToken: string): Promise<boolean> {
  const verifyUrl = `${process.env.NEXTAUTH_URL}/verify-email?token=${verificationToken}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button { display: inline-block; background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>メールアドレスの確認</h1>
          </div>
          <div class="content">
            <p>PPT Translatorへのご登録ありがとうございます。</p>
            <p>以下のボタンをクリックして、メールアドレスを確認してください。</p>
            <div style="text-align: center;">
              <a href="${verifyUrl}" class="button">メールアドレスを確認</a>
            </div>
            <p>このリンクは48時間有効です。</p>
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="font-size: 12px; color: #666;">
              ボタンが機能しない場合は、以下のURLをブラウザに直接コピー＆ペーストしてください：<br>
              <a href="${verifyUrl}" style="color: #10b981; word-break: break-all;">${verifyUrl}</a>
            </p>
          </div>
          <div class="footer">
            <p>© 2024 PPT Translator. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
メールアドレスの確認

PPT Translatorへのご登録ありがとうございます。
以下のURLからメールアドレスを確認してください：

${verifyUrl}

このリンクは48時間有効です。

© 2024 PPT Translator
  `;

  return sendEmail({
    to: email,
    subject: 'メールアドレスの確認',
    html,
    text,
  });
}

/**
 * ウェルカムメールを送信
 */
export async function sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
  const loginUrl = `${process.env.NEXTAUTH_URL}/login`;
  
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #6366f1; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9fafb; padding: 30px; }
          .button { display: inline-block; background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .features { background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ようこそ PPT Translator へ！</h1>
          </div>
          <div class="content">
            <p>${name ? `${name}様、` : ''}ご登録ありがとうございます！</p>
            <p>PPT Translatorは、PowerPointプレゼンテーションを簡単に翻訳できるツールです。</p>
            
            <div class="features">
              <h3>🚀 主な機能</h3>
              <ul>
                <li>高精度なAI翻訳（Claude 3.5使用）</li>
                <li>レイアウトを保持したまま翻訳</li>
                <li>複数言語対応</li>
                <li>翻訳履歴の管理</li>
                <li>バッチ処理対応</li>
              </ul>
            </div>
            
            <div style="text-align: center;">
              <a href="${loginUrl}" class="button">今すぐ始める</a>
            </div>
            
            <p>ご不明な点がございましたら、お気軽にお問い合わせください。</p>
          </div>
          <div class="footer">
            <p>© 2024 PPT Translator. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const text = `
ようこそ PPT Translator へ！

${name ? `${name}様、` : ''}ご登録ありがとうございます！

PPT Translatorは、PowerPointプレゼンテーションを簡単に翻訳できるツールです。

主な機能：
- 高精度なAI翻訳（Claude 3.5使用）
- レイアウトを保持したまま翻訳
- 複数言語対応
- 翻訳履歴の管理
- バッチ処理対応

今すぐ始める: ${loginUrl}

ご不明な点がございましたら、お気軽にお問い合わせください。

© 2024 PPT Translator
  `;

  return sendEmail({
    to: email,
    subject: 'PPT Translatorへようこそ！',
    html,
    text,
  });
}