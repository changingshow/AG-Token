/**
 * sql.js 类型声明
 * sql.js 是一个纯 JavaScript 的 SQLite 实现
 */

declare module 'sql.js' {
    export interface Database {
        run(sql: string, params?: any[]): Database;
        exec(sql: string): QueryExecResult[];
        prepare(sql: string): Statement;
        getRowsModified(): number;
        close(): void;
    }

    export interface Statement {
        bind(params?: any[]): boolean;
        step(): boolean;
        get(params?: any[]): any[];
        getAsObject(params?: any[]): Record<string, any>;
        run(params?: any[]): void;
        reset(): void;
        free(): boolean;
    }

    export interface QueryExecResult {
        columns: string[];
        values: any[][];
    }

    export interface SqlJsStatic {
        Database: new (data?: ArrayLike<number> | Buffer | null) => Database;
    }

    export default function initSqlJs(config?: {
        locateFile?: (file: string) => string;
    }): Promise<SqlJsStatic>;
}
