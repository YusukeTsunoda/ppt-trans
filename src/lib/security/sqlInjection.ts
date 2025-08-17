// import { Prisma } from '@prisma/client';
import logger from '@/lib/logger';

/**
 * SQLインジェクション対策
 */
export class SQLInjectionProtection {
  /**
   * 危険なSQLパターンを検出
   */
  private static readonly DANGEROUS_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|FROM|WHERE|ORDER BY|GROUP BY|HAVING)\b)/gi,
    /(-{2}|\/\*|\*\/|;|\||&&)/g, // SQLコメントや区切り文字
    /(0x[0-9a-f]+)/gi, // 16進数リテラル
    /(\bOR\b.*=.*)/gi, // OR 1=1 などの典型的なインジェクション
    /(\bAND\b.*=.*)/gi, // AND 1=1
    /(WAITFOR|DELAY|SLEEP|BENCHMARK)/gi, // タイミング攻撃
    /(xp_|sp_|@@|INFORMATION_SCHEMA|sys\.|CAST\(|CONVERT\()/gi, // システム関数
  ];
  
  /**
   * 入力値をサニタイズ
   */
  static sanitizeInput(input: string): string {
    if (!input) return '';
    
    // 基本的なサニタイゼーション
    const sanitized = input
      .replace(/'/g, "''") // シングルクォートをエスケープ
      .replace(/\\/g, '\\\\') // バックスラッシュをエスケープ
      .replace(/\0/g, '\\0') // NULL文字をエスケープ
      .replace(/\n/g, '\\n') // 改行をエスケープ
      .replace(/\r/g, '\\r') // キャリッジリターンをエスケープ
      .replace(/\x1a/g, '\\Z'); // Ctrl+Zをエスケープ
    
    return sanitized;
  }
  
  /**
   * SQLインジェクションの可能性を検証
   */
  static validateInput(input: string): { isValid: boolean; reason?: string } {
    if (!input) {
      return { isValid: true };
    }
    
    // 危険なパターンをチェック
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(input)) {
        const match = input.match(pattern);
        logger.warn('Potential SQL injection detected', {
          input: input.substring(0, 100),
          pattern: pattern.toString(),
          match: match?.[0]
        });
        
        return {
          isValid: false,
          reason: `危険なパターンが検出されました: ${match?.[0]}`
        };
      }
    }
    
    return { isValid: true };
  }
  
  /**
   * パラメータ化クエリ用の値を準備
   * Note: Supabase/PostgreSQLでは自動的にパラメータ化されるため、
   * この関数は主に追加の検証目的で使用
   */
  static prepareQueryParam(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }
    
    if (typeof value === 'string') {
      // 文字列の場合はサニタイズ
      return this.sanitizeInput(value);
    }
    
    if (typeof value === 'number') {
      // 数値の場合は範囲チェック
      if (!isFinite(value)) {
        throw new Error('Invalid number value');
      }
      return value;
    }
    
    if (value instanceof Date) {
      // 日付の場合はISO文字列に変換
      return value.toISOString();
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (Array.isArray(value)) {
      // 配列の場合は各要素を処理
      return value.map(v => this.prepareQueryParam(v));
    }
    
    if (typeof value === 'object') {
      // オブジェクトの場合はJSON文字列化
      return JSON.stringify(value);
    }
    
    // その他の型は拒否
    throw new Error(`Unsupported parameter type: ${typeof value}`);
  }
  
  /**
   * WHERE句の条件を安全に構築
   */
  static buildWhereClause(conditions: Record<string, any>): string {
    const clauses: string[] = [];
    
    for (const [key, value] of Object.entries(conditions)) {
      // カラム名の検証（英数字とアンダースコアのみ）
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid column name: ${key}`);
      }
      
      if (value === null) {
        clauses.push(`${key} IS NULL`);
      } else if (Array.isArray(value)) {
        // IN句の構築
        const sanitizedValues = value.map(v => 
          typeof v === 'string' ? `'${this.sanitizeInput(v)}'` : v
        );
        clauses.push(`${key} IN (${sanitizedValues.join(', ')})`);
      } else if (typeof value === 'string') {
        clauses.push(`${key} = '${this.sanitizeInput(value)}'`);
      } else {
        clauses.push(`${key} = ${value}`);
      }
    }
    
    return clauses.join(' AND ');
  }
  
  /**
   * ORDER BY句を安全に構築
   */
  static buildOrderByClause(
    column: string,
    direction: 'ASC' | 'DESC' = 'ASC'
  ): string {
    // カラム名の検証
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column)) {
      throw new Error(`Invalid column name for ORDER BY: ${column}`);
    }
    
    // 方向の検証
    if (!['ASC', 'DESC'].includes(direction.toUpperCase())) {
      throw new Error(`Invalid sort direction: ${direction}`);
    }
    
    return `${column} ${direction}`;
  }
  
  /**
   * LIMIT句を安全に構築
   */
  static buildLimitClause(limit: number, offset?: number): string {
    // 数値の検証
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error(`Invalid limit value: ${limit}`);
    }
    
    if (offset !== undefined && (!Number.isInteger(offset) || offset < 0)) {
      throw new Error(`Invalid offset value: ${offset}`);
    }
    
    return offset !== undefined 
      ? `LIMIT ${limit} OFFSET ${offset}`
      : `LIMIT ${limit}`;
  }
  
  /**
   * テーブル名を検証
   */
  static validateTableName(tableName: string): boolean {
    // テーブル名は英数字、アンダースコア、ドットのみ（スキーマ付きの場合）
    return /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)?$/.test(tableName);
  }
  
  /**
   * カラム名を検証
   */
  static validateColumnName(columnName: string): boolean {
    // カラム名は英数字とアンダースコアのみ
    return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(columnName);
  }
}

export default SQLInjectionProtection;