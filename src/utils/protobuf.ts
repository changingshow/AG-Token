/**
 * Protobuf 解析工具
 * 用于从 Antigravity 的数据库中提取 Token
 * 
 * 参考 Rust 版本: src-tauri/src/utils/protobuf.rs
 */

/**
 * 读取 Protobuf Varint
 */
export function readVarint(buffer: Buffer, offset: number): [bigint, number] | null {
    let result = BigInt(0);
    let shift = BigInt(0);
    let pos = offset;

    while (pos < buffer.length) {
        const byte = buffer[pos];
        result |= BigInt(byte & 0x7F) << shift;
        pos++;
        if ((byte & 0x80) === 0) {
            return [result, pos];
        }
        shift += BigInt(7);
    }

    return null;
}

/**
 * 跳过 Protobuf 字段
 */
export function skipField(buffer: Buffer, offset: number, wireType: number): number | null {
    switch (wireType) {
        case 0: {
            const result = readVarint(buffer, offset);
            return result ? result[1] : null;
        }
        case 1:
            return offset + 8;
        case 2: {
            const lengthResult = readVarint(buffer, offset);
            if (!lengthResult) return null;
            const [length, contentOffset] = lengthResult;
            return contentOffset + Number(length);
        }
        case 5:
            return offset + 4;
        default:
            return null;
    }
}

/**
 * 在 Protobuf 数据中查找指定字段 (Length-Delimited only)
 */
export function findProtobufField(buffer: Buffer, targetField: number): Buffer | null {
    let offset = 0;

    while (offset < buffer.length) {
        const tagResult = readVarint(buffer, offset);
        if (!tagResult) {
            break;
        }
        const [tag, newOffset] = tagResult;

        const wireType = Number(tag & BigInt(7));
        const fieldNum = Number(tag >> BigInt(3));

        if (fieldNum === targetField && wireType === 2) {
            const lengthResult = readVarint(buffer, newOffset);
            if (!lengthResult) return null;
            const [length, contentOffset] = lengthResult;
            return buffer.subarray(contentOffset, contentOffset + Number(length));
        }

        const nextOffset = skipField(buffer, newOffset, wireType);
        if (nextOffset === null) {
            break;
        }
        offset = nextOffset;
    }

    return null;
}

/**
 * 从 Base64 编码数据中提取 Refresh Token
 */
export function extractRefreshTokenFromProtobuf(base64Data: string): string | null {
    try {
        const buffer = Buffer.from(base64Data, 'base64');

        // Field 6 = oauthTokenInfo
        const oauthData = findProtobufField(buffer, 6);
        if (!oauthData) {
            return null;
        }

        // Field 3 = refresh_token
        const refreshTokenBuffer = findProtobufField(oauthData, 3);
        if (!refreshTokenBuffer) {
            return null;
        }

        return refreshTokenBuffer.toString('utf-8');
    } catch {
        return null;
    }
}

/**
 * 从 Base64 编码数据中提取 Access Token
 */
export function extractAccessTokenFromProtobuf(base64Data: string): string | null {
    try {
        const buffer = Buffer.from(base64Data, 'base64');

        const oauthData = findProtobufField(buffer, 6);
        if (!oauthData) {
            return null;
        }

        // Field 1 = access_token
        const accessTokenBuffer = findProtobufField(oauthData, 1);
        if (!accessTokenBuffer) {
            return null;
        }

        return accessTokenBuffer.toString('utf-8');
    } catch {
        return null;
    }
}

/**
 * 从 Base64 编码数据中提取过期时间
 */
export function extractExpiryFromProtobuf(base64Data: string): number | null {
    try {
        const buffer = Buffer.from(base64Data, 'base64');

        const oauthData = findProtobufField(buffer, 6);
        if (!oauthData) {
            return null;
        }

        // Field 4 = expiry (嵌套的 Timestamp 消息)
        const expiryData = findProtobufField(oauthData, 4);
        if (!expiryData) {
            return null;
        }

        // Timestamp 消息中: Field 1 = seconds (varint)
        let offset = 0;
        while (offset < expiryData.length) {
            const tagResult = readVarint(expiryData, offset);
            if (!tagResult) break;
            const [tag, newOffset] = tagResult;

            const wireType = Number(tag & BigInt(7));
            const fieldNum = Number(tag >> BigInt(3));

            if (fieldNum === 1 && wireType === 0) {
                const valueResult = readVarint(expiryData, newOffset);
                if (valueResult) {
                    return Number(valueResult[0]);
                }
            }

            const nextOffset = skipField(expiryData, newOffset, wireType);
            if (nextOffset === null) break;
            offset = nextOffset;
        }

        return null;
    } catch {
        return null;
    }
}
