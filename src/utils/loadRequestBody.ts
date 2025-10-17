import fs from 'fs';
import path from 'path';
import { injectVariables } from './variableStore';

export function loadRequestBody(bodyFile?: string, body?: any, isSoap = false): any {
    if (bodyFile) {
        const bodyFilePath = path.normalize(path.resolve(__dirname, '../', bodyFile));
        const raw = fs.readFileSync(bodyFilePath, 'utf-8');
        const injected = injectVariables(raw);
        return isSoap ? injected : JSON.parse(injected);
    }

    if (body) {
        const injected = injectVariables(typeof body === 'string' ? body : JSON.stringify(body));
        return isSoap ? injected : JSON.parse(injected);
    }

    return undefined;
}
