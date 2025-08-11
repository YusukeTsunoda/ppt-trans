import { Prisma } from '@prisma/client';
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
    let sanitized = input
      .replace(/'/g, "''") // シングルクォートをエスケープ
      .replace(/\\/g, '\\\\') // バックスラッシュをエスケープ
      .replace(/\0/g, '') // NUL文字を削除
      .replace(/\n/g, ' ') // 改行をスペースに
      .replace(/\r/g, ' ') // キャリッジリターンをスペースに
      .replace(/\t/g, ' ') // タブをスペースに
      .trim();
    
    // 危険なパターンの検出
    for (const pattern of this.DANGEROUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        logger.warn('Potential SQL injection detected', {
          input: sanitized.substring(0, 100),
          pattern: pattern.toString(),
        });
        // 危険な文字列を削除
        sanitized = sanitized.replace(pattern, '');
      }
    }
    
    return sanitized;
  }
  
  /**
   * 数値入力の検証
   */
  static validateNumericInput(input: any): number | null {
    const num = Number(input);
    
    if (isNaN(num) || !isFinite(num)) {
      logger.warn('Invalid numeric input', { input });
      return null;
    }
    
    // 整数の範囲チェック
    if (num > Number.MAX_SAFE_INTEGER || num < Number.MIN_SAFE_INTEGER) {
      logger.warn('Numeric input out of safe range', { input: num });
      return null;
    }
    
    return num;
  }
  
  /**
   * LIKE句用の入力をエスケープ
   */
  static escapeLikePattern(pattern: string): string {
    return pattern
      .replace(/\\/g, '\\\\') // バックスラッシュをエスケープ
      .replace(/%/g, '\\%') // パーセント記号をエスケープ
      .replace(/_/g, '\\_'); // アンダースコアをエスケープ
  }
  
  /**
   * Prismaクエリ用の安全なパラメータを生成
   */
  static buildSafeWhereClause(
    field: string,
    value: any,
    operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn' = 'equals'
  ): Record<string, any> {
    // フィールド名の検証
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field)) {
      logger.warn('Invalid field name', { field });
      throw new Error('Invalid field name');
    }
    
    // 値のサニタイゼーション
    let sanitizedValue: any;
    
    if (typeof value === 'string') {
      sanitizedValue = this.sanitizeInput(value);
      
      // LIKE操作の場合は追加のエスケープ
      if (['contains', 'startsWith', 'endsWith'].includes(operator)) {
        sanitizedValue = this.escapeLikePattern(sanitizedValue);
      }
    } else if (typeof value === 'number') {
      sanitizedValue = this.validateNumericInput(value);
      if (sanitizedValue === null) {
        throw new Error('Invalid numeric value');
      }
    } else if (Array.isArray(value)) {
      sanitizedValue = value.map(v => 
        typeof v === 'string' ? this.sanitizeInput(v) : v
      );
    } else {
      sanitizedValue = value;
    }
    
    // Prismaクエリオブジェクトを構築
    return {
      [field]: {
        [operator]: sanitizedValue,
      },
    };
  }
  
  /**
   * 複数条件のWHERE句を安全に構築
   */
  static buildSafeWhereConditions(
    conditions: Array<{
      field: string;
      value: any;
      operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'in' | 'notIn';
    }>
  ): Prisma.JsonObject {
    const whereClause: any = {
      AND: [],
    };
    
    for (const condition of conditions) {
      try {
        const safeCondition = this.buildSafeWhereClause(
          condition.field,
          condition.value,
          condition.operator
        );
        whereClause.AND.push(safeCondition);
      } catch (error) {
        logger.error('Failed to build safe WHERE condition', { condition, error });
        // 無効な条件はスキップ
      }
    }
    
    return whereClause;
  }
  
  /**
   * ORDER BY句を安全に構築
   */
  static buildSafeOrderBy(
    field: string,
    direction: 'asc' | 'desc' = 'asc'
  ): Record<string, 'asc' | 'desc'> {
    // フィールド名の検証
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(field)) {
      logger.warn('Invalid field name for ORDER BY', { field });
      throw new Error('Invalid field name');
    }
    
    // 方向の検証
    if (!['asc', 'desc'].includes(direction.toLowerCase())) {
      logger.warn('Invalid sort direction', { direction });
      throw new Error('Invalid sort direction');
    }
    
    return {
      [field]: direction.toLowerCase() as 'asc' | 'desc',
    };
  }
  
  /**
   * LIMIT/OFFSETを安全に設定
   */
  static buildSafePagination(
    page: number = 1,
    limit: number = 20
  ): { take: number; skip: number } {
    // ページ番号の検証
    const safePage = Math.max(1, Math.floor(page));
    
    // 制限値の検証（最大100件）
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit)));
    
    return {
      take: safeLimit,
      skip: (safePage - 1) * safeLimit,
    };
  }
  
  /**
   * JSONパスを安全に構築
   */
  static buildSafeJsonPath(path: string[]): string {
    return path
      .filter(p => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(p))
      .map(p => `'${p}'`)
      .join('.');
  }
  
  /**
   * Raw SQLクエリを検証（使用は推奨されない）
   */
  static validateRawQuery(query: string): boolean {
    // 危険なキーワードをチェック
    const dangerousKeywords = [
      'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE',
      'EXEC', 'EXECUTE', 'xp_', 'sp_', 'GRANT', 'REVOKE',
    ];
    
    const upperQuery = query.toUpperCase();
    
    for (const keyword of dangerousKeywords) {
      if (upperQuery.includes(keyword)) {
        logger.error('Dangerous keyword detected in raw query', {
          keyword,
          query: query.substring(0, 100),
        });
        return false;
      }
    }
    
    // 複数ステートメントの検出
    if (query.includes(';')) {
      logger.error('Multiple statements detected in raw query');
      return false;
    }
    
    return true;
  }
}

/**
 * Prismaクエリビルダーのセキュアラッパー
 */
export class SecurePrismaQueryBuilder {
  /**
   * 安全な検索クエリを構築
   */
  static buildSearchQuery(
    searchTerm: string,
    fields: string[],
    additionalWhere?: Prisma.JsonObject
  ): Prisma.JsonObject {
    const sanitized = SQLInjectionProtection.sanitizeInput(searchTerm);
    
    const searchConditions = fields.map(field => ({
      [field]: {
        contains: sanitized,
        mode: 'insensitive' as const,
      },
    }));
    
    return {
      AND: [
        { OR: searchConditions },
        ...(additionalWhere ? [additionalWhere] : []),
      ],
    };
  }
  
  /**
   * 安全なフィルタークエリを構築
   */
  static buildFilterQuery(
    filters: Record<string, any>
  ): Prisma.JsonObject {
    const conditions: any[] = [];
    
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined || value === '') {
        continue;
      }
      
      try {
        const condition = SQLInjectionProtection.buildSafeWhereClause(
          key,
          value,
          Array.isArray(value) ? 'in' : 'equals'
        );
        conditions.push(condition);
      } catch (error) {
        logger.warn('Invalid filter condition', { key, value, error });
      }
    }
    
    return conditions.length > 0 ? { AND: conditions } : {};
  }
}