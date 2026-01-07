/**
 * SQLite 数据库读取器
 * 使用 sql.js (纯 JavaScript 实现) 读取 state.vscdb 文件
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

// 定义 sql.js 类型
interface SqlJsDatabase {
    prepare(sql: string): SqlJsStatement;
    close(): void;
}

interface SqlJsStatement {
    bind(params?: unknown[]): boolean;
    step(): boolean;
    get(params?: unknown[]): unknown[];
    free(): boolean;
}

interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => SqlJsDatabase;
}

// sql.js 单例
let sqlJsInstance: SqlJsStatic | null = null;
let sqlJsInitPromise: Promise<SqlJsStatic | null> | null = null;
let extensionPath: string | null = null;

/**
 * 设置扩展根目录
 */
export function setExtensionPath(path: string): void {
    extensionPath = path;
}

// Webpack-specific require to bypass bundling
declare const __non_webpack_require__: NodeRequire;

/**
 * 初始化 sql.js
 */
async function getSqlJs(): Promise<SqlJsStatic | null> {
    if (sqlJsInstance) return sqlJsInstance;
    if (sqlJsInitPromise) return sqlJsInitPromise;

    sqlJsInitPromise = (async () => {
        try {
            let wasmPath: string;
            let initSqlJs: any;

            // Use eval('require') as a fallback if __non_webpack_require__ is not defined (e.g. in tests)
            const dynamicRequire = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : eval('require');

            if (extensionPath) {
                // Production: Look in dist folder (bundled)
                const distPath = path.join(extensionPath, 'dist');
                const localJsPath = path.join(distPath, 'sql-wasm.js');
                const localWasmPath = path.join(distPath, 'sql-wasm.wasm');

                if (fs.existsSync(localJsPath) && fs.existsSync(localWasmPath)) {
                    wasmPath = distPath;
                    initSqlJs = dynamicRequire(localJsPath);
                } else {
                    // Dev/Fallback: Look in node_modules
                    const nodeModulesPath = path.join(extensionPath, 'node_modules', 'sql.js', 'dist');
                    wasmPath = nodeModulesPath;
                    initSqlJs = dynamicRequire(path.join(nodeModulesPath, 'sql-wasm.js'));
                }
            } else {
                // Fallback when extensionPath is not set
                const nodeModulesPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
                wasmPath = nodeModulesPath;
                initSqlJs = dynamicRequire(path.join(nodeModulesPath, 'sql-wasm.js'));
            }

            sqlJsInstance = await initSqlJs({
                locateFile: (file: string) => path.join(wasmPath, file)
            });

            return sqlJsInstance;
        } catch (error) {
            console.error('[SQLite] 初始化失败:', error);
            vscode.window.showErrorMessage(`[Debug] SQLite Init Failed: ${error instanceof Error ? error.message : String(error)}`);
            sqlJsInitPromise = null;
            return null;
        }
    })();

    return sqlJsInitPromise;
}

/**
 * 验证 SQLite 文件
 */
export function isValidSqliteFile(filePath: string): boolean {
    try {
        const buffer = fs.readFileSync(filePath);
        if (buffer.length < 100) return false;
        return buffer.subarray(0, 16).toString('utf-8').startsWith('SQLite format 3');
    } catch {
        return false;
    }
}

/**
 * 验证 Base64 字符串
 */
export function isValidBase64(str: string): boolean {
    if (!str || str.length < 10) return false;
    if (!/^[A-Za-z0-9+/]+=*$/.test(str)) return false;
    try {
        return Buffer.from(str, 'base64').length > 0;
    } catch {
        return false;
    }
}

/**
 * 回退方法：字符串搜索
 */
function fallbackReadValue(dbPath: string, key: string): string | null {
    try {
        const buffer = fs.readFileSync(dbPath);
        const content = buffer.toString('binary');

        const keyIndex = content.indexOf(key);
        if (keyIndex === -1) return null;

        const afterKey = content.slice(keyIndex + key.length);
        const base64Match = afterKey.match(/[A-Za-z0-9+/]{100,}={0,2}/);

        if (base64Match && isValidBase64(base64Match[0])) {
            return base64Match[0];
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * 从 SQLite 数据库读取值
 */
export async function readValueFromDatabase(dbPath: string, key: string): Promise<string | null> {
    let db: SqlJsDatabase | null = null;

    try {
        if (!fs.existsSync(dbPath) || !isValidSqliteFile(dbPath)) {
            return null;
        }

        const SQL = await getSqlJs();
        if (!SQL) {
            return fallbackReadValue(dbPath, key);
        }

        const fileBuffer = fs.readFileSync(dbPath);
        db = new SQL.Database(fileBuffer);

        const stmt = db.prepare('SELECT value FROM ItemTable WHERE key = ?');
        stmt.bind([key]);

        if (stmt.step()) {
            const row = stmt.get();
            stmt.free();

            if (row && row[0]) {
                return row[0] as string;
            }
        }

        stmt.free();
        return null;
    } catch (error) {
        console.error('[SQLite] 读取失败:', error);
        return fallbackReadValue(dbPath, key);
    } finally {
        if (db) db.close();
    }
}
