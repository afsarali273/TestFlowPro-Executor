import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export type Assertion = {
    type:
        | 'equals'
        | 'notEquals'
        | 'contains'
        | 'startsWith'
        | 'endsWith'
        | 'greaterThan'
        | 'lessThan'
        | 'in'
        | 'notIn'
        | 'includesAll'
        | 'length'
        | 'size'
        | 'statusCode'
        | 'type'
        | 'exists'
        | 'regex'
        | 'arrayObjectMatch';
    jsonPath: string;
    expected?: any;
    matchField?: string;
    matchValue?: string;
    assertField?: string;
};

export interface StoreMap {
    [variable: string]: string;
}

export interface TestData {
    name: string;
    method: string;
    endpoint: string;
    headers?: Record<string, string>;
    preProcess: any[];
    body?: any;
    bodyFile?: string;
    assertions?: Assertion[];
    responseSchema?: any;
    responseSchemaFile?: string;
    store?: StoreMap;
}

export interface TestCase {
    name: string;
    status?: string;
    testData: TestData[];
}

export interface Tag {
    [key: string]: string;
}

export interface TestSuite {
    suiteName: string;
    status: 'Not Started',
    tags?: Tag[];
    baseUrl?: string;
    testCases: TestCase[];
    id?: string;
    filePath?: string;
    fileName?: string;
    lastModified?: string;
}

export function convertSwaggerToTestSuite(swagger: any): TestSuite {
    const baseUrl = `https://${swagger.host || 'localhost'}${swagger.basePath || ''}`;
    const testCases: TestCase[] = [];

    for (const [path, methods] of Object.entries(swagger.paths)) {
        const testDataList: TestData[] = [];

        // @ts-ignore
        for (const [method, op] of Object.entries<any>(methods)) {
            const consumes = op.consumes?.[0] || 'application/json';
            const testData: TestData = {
                name: op.summary || `${method.toUpperCase()} ${path}`,
                method: method.toUpperCase(),
                endpoint: path.replace(/{/g, '{{').replace(/}/g, '}}'),
                headers: { 'Content-Type': consumes },
                preProcess: [],
                assertions: [
                    {
                        type: 'statusCode',
                        jsonPath: '$.',
                        expected: 200
                    }
                ],
                store: {}
            };

            testDataList.push(testData);
        }

        testCases.push({
            name: `Test ${path}`,
            status: 'Not Started',
            testData: testDataList
        });
    }

    const suiteName = `${swagger.info.title} Auto Suite`;
    const suite: TestSuite = {
        suiteName,
        status: 'Not Started',
        tags: [
            { swaggerVersion: swagger.swagger },
            { suiteType: '@generated' }
        ],
        baseUrl,
        testCases,
        id: 'generated_' + uuidv4(),
        fileName: suiteName.replace(/\s+/g, '_') + '.json',
        filePath: '',
        lastModified: new Date().toISOString()
    };

    if (suite.fileName != null) {
        suite.filePath = path.normalize(path.join('./testSuites', suite.fileName));
    }
    return suite;
}

export function saveTestSuite(suite: TestSuite) {
    fs.mkdirSync(path.dirname(path.normalize(suite.filePath!)), { recursive: true });
    fs.writeFileSync(suite.filePath!, JSON.stringify(suite, null, 2));
    console.log(`✅ Test suite saved: ${suite.filePath}`);
}

if (require.main === module) {
    const filePath = process.argv[2];
    if (!filePath) {
        console.error('Usage: ts-node swaggerSuiteGenerator.ts <swagger.json>');
        process.exit(1);
    }
    const swagger = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const suite = convertSwaggerToTestSuite(swagger);
    saveTestSuite(suite);
}
