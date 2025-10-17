import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

export interface ParameterSet {
    [key: string]: any;
}

export function loadParameterData(dataSource: any): ParameterSet[] {
    if (!dataSource || dataSource.type === 'inline') {
        return dataSource?.data || [];
    }

    if (dataSource.type === 'csv' && dataSource.filePath) {
        const resolvedPath = path.resolve(dataSource.filePath);
        const csvContent = fs.readFileSync(resolvedPath, 'utf-8');
        return parse(csvContent, { columns: true, skip_empty_lines: true });
    }

    if (dataSource.type === 'json' && dataSource.filePath) {
        const resolvedPath = path.resolve(dataSource.filePath);
        const jsonContent = fs.readFileSync(resolvedPath, 'utf-8');
        return JSON.parse(jsonContent);
    }

    return [];
}

export function injectParameters(template: string, parameters: ParameterSet): string {
    let result = template;
    
    for (const [key, value] of Object.entries(parameters)) {
        // Handle both {{param.key}} and {{key}} formats
        const paramRegex = new RegExp(`"{{param\\.${key}}}"|{{param\\.${key}}}`, 'g');
        const directRegex = new RegExp(`"{{${key}}}"|{{${key}}}`, 'g');
        
        // Convert value to appropriate type
        const convertedValue = convertToAppropriateType(value);
        
        result = result.replace(paramRegex, convertedValue);
        result = result.replace(directRegex, convertedValue);
    }
    
    return result;
}

function convertToAppropriateType(value: any): string {
    if (value === null || value === undefined) {
        return 'null';
    }
    
    if (typeof value === 'boolean') {
        return String(value);
    }
    
    if (typeof value === 'number') {
        return String(value);
    }
    
    // Check if string represents a number
    const stringValue = String(value).trim();
    
    // Check for boolean values
    if (stringValue.toLowerCase() === 'true') {
        return 'true';
    }
    if (stringValue.toLowerCase() === 'false') {
        return 'false';
    }
    
    // Check for null
    if (stringValue.toLowerCase() === 'null') {
        return 'null';
    }
    
    // Check if it's a valid number
    if (/^-?\d+(\.\d+)?$/.test(stringValue)) {
        return stringValue; // Return as number without quotes
    }
    
    // Return as quoted string
    return `"${stringValue}"`;
}

export function injectParametersInObject(obj: any, parameters: ParameterSet): any {
    if (typeof obj === 'string') {
        const injected = injectParameters(obj, parameters);
        
        // If the string looks like JSON, try to parse it to handle type conversion
        if (injected.trim().startsWith('{') || injected.trim().startsWith('[')) {
            try {
                return JSON.parse(injected);
            } catch {
                // If parsing fails, return as string
                return injected;
            }
        }
        
        return injected;
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => injectParametersInObject(item, parameters));
    }
    
    if (obj && typeof obj === 'object') {
        // First convert object to JSON string, inject parameters, then parse back
        const jsonString = JSON.stringify(obj);
        const injectedString = injectParameters(jsonString, parameters);
        
        try {
            return JSON.parse(injectedString);
        } catch {
            // If parsing fails, fall back to field-by-field injection
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                result[key] = injectParametersInObject(value, parameters);
            }
            return result;
        }
    }
    
    return obj;
}