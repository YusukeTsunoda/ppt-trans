/**
 * セキュアなデータベースクエリビルダー
 * SQLインジェクション攻撃を防ぐためのヘルパー関数群
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * 安全な文字列エスケープ
 */
export function escapeSqlIdentifier(identifier: string): string {
  // 英数字とアンダースコアのみを許可
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
  return identifier;
}

/**
 * 安全な値のサニタイズ
 */
export function sanitizeValue(value: any): any {
  if (value === null || value === undefined) {
    return null;
  }
  
  if (typeof value === 'string') {
    // 危険な文字をエスケープ
    return value
      .replace(/'/g, "''")  // シングルクォートをエスケープ
      .replace(/;/g, '')    // セミコロンを除去
      .replace(/--/g, '');  // SQLコメントを除去
  }
  
  if (typeof value === 'number') {
    // 数値が有効か確認
    if (!isFinite(value)) {
      throw new Error('Invalid numeric value');
    }
    return value;
  }
  
  if (typeof value === 'boolean') {
    return value;
  }
  
  if (value instanceof Date) {
    return value.toISOString();
  }
  
  // その他の型は文字列化
  return String(value);
}

/**
 * WHERE条件の安全な構築
 */
export interface WhereCondition {
  column: string;
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'in' | 'like' | 'ilike';
  value: any;
}

export function buildWhereClause(conditions: WhereCondition[]): string {
  if (conditions.length === 0) return '';
  
  const clauses = conditions.map(({ column, operator, value }) => {
    const safeColumn = escapeSqlIdentifier(column);
    const safeValue = sanitizeValue(value);
    
    if (operator === 'in' && Array.isArray(value)) {
      const safeValues = value.map(v => `'${sanitizeValue(v)}'`).join(',');
      return `${safeColumn} IN (${safeValues})`;
    }
    
    if (operator === 'like' || operator === 'ilike') {
      return `${safeColumn} ${operator.toUpperCase()} '${safeValue}'`;
    }
    
    return `${safeColumn} ${operator} '${safeValue}'`;
  });
  
  return clauses.join(' AND ');
}

/**
 * ページネーションパラメータの検証
 */
export interface PaginationParams {
  page: number;
  limit: number;
}

export function validatePagination(params: Partial<PaginationParams>): PaginationParams {
  const page = Math.max(1, Math.floor(Number(params.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(params.limit) || 10)));
  
  return { page, limit };
}

/**
 * ORDER BY句の安全な構築
 */
export interface OrderByClause {
  column: string;
  direction: 'asc' | 'desc';
}

export function buildOrderBy(orderBy: OrderByClause[]): string {
  if (orderBy.length === 0) return '';
  
  const clauses = orderBy.map(({ column, direction }) => {
    const safeColumn = escapeSqlIdentifier(column);
    const safeDirection = direction === 'desc' ? 'DESC' : 'ASC';
    return `${safeColumn} ${safeDirection}`;
  });
  
  return clauses.join(', ');
}

/**
 * セキュアなクエリビルダークラス
 */
export class SecureQueryBuilder<T> {
  private supabase: SupabaseClient;
  private table: string;
  private selectColumns: string[] = ['*'];
  private whereConditions: WhereCondition[] = [];
  private orderByClauses: OrderByClause[] = [];
  private limitValue?: number;
  private offsetValue?: number;

  constructor(supabase: SupabaseClient, table: string) {
    this.supabase = supabase;
    this.table = escapeSqlIdentifier(table);
  }

  select(columns: string[]): this {
    this.selectColumns = columns.map(col => escapeSqlIdentifier(col));
    return this;
  }

  where(column: string, operator: WhereCondition['operator'], value: any): this {
    this.whereConditions.push({ column, operator, value });
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'asc'): this {
    this.orderByClauses.push({ column, direction });
    return this;
  }

  limit(value: number): this {
    this.limitValue = Math.min(1000, Math.max(1, Math.floor(value)));
    return this;
  }

  offset(value: number): this {
    this.offsetValue = Math.max(0, Math.floor(value));
    return this;
  }

  async execute(): Promise<{ data: T[] | null; error: any }> {
    let query = this.supabase
      .from(this.table)
      .select(this.selectColumns.join(', '));

    // WHERE条件を適用
    this.whereConditions.forEach(({ column, operator, value }) => {
      const safeColumn = escapeSqlIdentifier(column);
      const safeValue = sanitizeValue(value);
      
      switch (operator) {
        case '=':
          query = query.eq(safeColumn, safeValue);
          break;
        case '!=':
          query = query.neq(safeColumn, safeValue);
          break;
        case '<':
          query = query.lt(safeColumn, safeValue);
          break;
        case '>':
          query = query.gt(safeColumn, safeValue);
          break;
        case '<=':
          query = query.lte(safeColumn, safeValue);
          break;
        case '>=':
          query = query.gte(safeColumn, safeValue);
          break;
        case 'in':
          query = query.in(safeColumn, Array.isArray(value) ? value.map(sanitizeValue) : [safeValue]);
          break;
        case 'like':
          query = query.like(safeColumn, safeValue);
          break;
        case 'ilike':
          query = query.ilike(safeColumn, safeValue);
          break;
      }
    });

    // ORDER BY
    this.orderByClauses.forEach(({ column, direction }) => {
      query = query.order(escapeSqlIdentifier(column), { ascending: direction === 'asc' });
    });

    // LIMIT/OFFSET
    if (this.limitValue !== undefined) {
      query = query.limit(this.limitValue);
    }
    if (this.offsetValue !== undefined) {
      query = query.range(this.offsetValue, this.offsetValue + (this.limitValue || 10) - 1);
    }

    const result = await query;
    return {
      data: result.data as T[] | null,
      error: result.error
    };
  }
}

/**
 * ヘルパー関数：セキュアなクエリビルダーの作成
 */
export function createSecureQuery<T>(
  supabase: SupabaseClient,
  table: string
): SecureQueryBuilder<T> {
  return new SecureQueryBuilder<T>(supabase, table);
}