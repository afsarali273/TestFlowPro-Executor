import fs from 'fs';
import path from 'path';

const schemaCache = new Map<string, object>();

export function loadSchema(schemaPath: string): object {
    const fullPath = path.normalize(path.resolve(__dirname, '../', schemaPath));
    if (schemaCache.has(fullPath)) return schemaCache.get(fullPath)!;

    const raw = fs.readFileSync(fullPath, 'utf-8');
    const schema = JSON.parse(raw);
    schemaCache.set(fullPath, schema);
    return schema;
}
