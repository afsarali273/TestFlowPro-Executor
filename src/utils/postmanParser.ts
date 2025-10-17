import { TestSuite, TestCase, TestData, Assertion } from '../types';

export interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    _postman_id?: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

export interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
  event?: PostmanEvent[];
}

export interface PostmanRequest {
  method: string;
  header?: PostmanHeader[];
  url: PostmanUrl | string;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

export interface PostmanUrl {
  raw: string;
  protocol?: string;
  host?: string[];
  port?: string;
  path?: string[];
  query?: PostmanQuery[];
}

export interface PostmanHeader {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanBody {
  mode: 'raw' | 'formdata' | 'urlencoded' | 'file' | 'graphql';
  raw?: string;
  formdata?: any[];
  urlencoded?: any[];
}

export interface PostmanQuery {
  key: string;
  value: string;
  disabled?: boolean;
}

export interface PostmanVariable {
  key: string;
  value: string;
  type?: string;
}

export interface PostmanAuth {
  type: string;
  [key: string]: any;
}

export interface PostmanEvent {
  listen: 'prerequest' | 'test';
  script: {
    type?: string;
    exec: string[];
  };
}

export interface PostmanParseResult {
  success: boolean;
  testSuite?: TestSuite;
  error?: string;
}

export class PostmanParser {
  static parse(collectionJson: string | PostmanCollection): PostmanParseResult {
    try {
      const collection = typeof collectionJson === 'string' 
        ? JSON.parse(collectionJson) 
        : collectionJson;
      
      const testSuite = this.convertToTestSuite(collection);
      return { success: true, testSuite };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private static convertToTestSuite(collection: PostmanCollection): TestSuite {
    const baseUrl = this.extractBaseUrl(collection);
    const testCases = this.processItems(collection.item, '');
    
    return {
      id: `postman-${Date.now()}`,
      suiteName: collection.info.name,
      applicationName: collection.info.name,
      type: 'API',
      baseUrl,
      tags: [
        { source: '@postman' },
        { collection: `@${collection.info.name.toLowerCase().replace(/\s+/g, '-')}` }
      ],
      testCases
    };
  }

  private static extractBaseUrl(collection: PostmanCollection): string {
    // Try to extract base URL from variables
    const baseUrlVar = collection.variable?.find(v => 
      v.key.toLowerCase().includes('baseurl') || 
      v.key.toLowerCase().includes('host') ||
      v.key.toLowerCase().includes('url')
    );
    
    if (baseUrlVar) {
      return baseUrlVar.value;
    }

    // Extract from first request
    const firstRequest = this.findFirstRequest(collection.item);
    if (firstRequest) {
      const url = this.parseUrl(firstRequest.url);
      if (url.protocol && url.host) {
        return `${url.protocol}://${Array.isArray(url.host) ? url.host.join('.') : url.host}${url.port ? ':' + url.port : ''}`;
      }
    }

    return 'https://api.example.com';
  }

  private static findFirstRequest(items: PostmanItem[]): PostmanRequest | null {
    for (const item of items) {
      if (item.request) {
        return item.request;
      }
      if (item.item) {
        const nested = this.findFirstRequest(item.item);
        if (nested) return nested;
      }
    }
    return null;
  }

  private static processItems(items: PostmanItem[], parentName: string): TestCase[] {
    const testCases: TestCase[] = [];

    for (const item of items) {
      if (item.item) {
        // Folder - create test case with multiple test data
        const folderTestCase = this.processFolderAsTestCase(item, parentName);
        if (folderTestCase) {
          testCases.push(folderTestCase);
        }
      } else if (item.request) {
        // Single request - create individual test case
        const singleTestCase = this.processRequestAsTestCase(item, parentName);
        if (singleTestCase) {
          testCases.push(singleTestCase);
        }
      }
    }

    return testCases;
  }

  private static processFolderAsTestCase(folder: PostmanItem, parentName: string): TestCase | null {
    if (!folder.item) return null;

    const testData: TestData[] = [];
    
    for (const item of folder.item) {
      if (item.request) {
        const data = this.convertRequestToTestData(item);
        if (data) {
          testData.push(data);
        }
      }
    }

    if (testData.length === 0) return null;

    return {
      name: parentName ? `${parentName} > ${folder.name}` : folder.name,
      type: 'REST',
      testData,
      testSteps: []
    };
  }

  private static processRequestAsTestCase(item: PostmanItem, parentName: string): TestCase | null {
    const testData = this.convertRequestToTestData(item);
    if (!testData) return null;

    // Generate multiple test scenarios
    const testDataArray = this.generateTestScenarios(testData, item);

    return {
      name: parentName ? `${parentName} > ${item.name}` : item.name,
      type: 'REST',
      testData: testDataArray,
      testSteps: []
    };
  }

  private static convertRequestToTestData(item: PostmanItem): TestData | null {
    if (!item.request) return null;

    const request = item.request;
    const url = this.parseUrl(request.url);
    const headers = this.parseHeaders(request.header);
    const body = this.parseBody(request.body);
    const assertions = this.parseTestScript(item.event);
    const preProcess = this.parsePreRequestScript(item.event);

    return {
      name: item.name,
      method: request.method.toUpperCase(),
      endpoint: this.buildEndpoint(url),
      headers,
      ...(body && { body }),
      ...(preProcess.length > 0 && { preProcess }),
      assertions: assertions.length > 0 ? assertions : this.generateDefaultAssertions(request.method)
    };
  }

  private static parseUrl(url: PostmanUrl | string): PostmanUrl {
    if (typeof url === 'string') {
      try {
        const parsed = new URL(url);
        return {
          raw: url,
          protocol: parsed.protocol.replace(':', ''),
          host: [parsed.hostname],
          port: parsed.port,
          path: parsed.pathname.split('/').filter(p => p),
          query: Array.from(parsed.searchParams.entries()).map(([key, value]) => ({ key, value }))
        };
      } catch {
        return { raw: url };
      }
    }
    return url;
  }

  private static buildEndpoint(url: PostmanUrl): string {
    let endpoint = '/';
    
    if (url.path && url.path.length > 0) {
      endpoint = '/' + url.path.join('/');
    }
    
    if (url.query && url.query.length > 0) {
      const queryString = url.query
        .filter(q => !q.disabled)
        .map(q => `${q.key}=${q.value}`)
        .join('&');
      if (queryString) {
        endpoint += '?' + queryString;
      }
    }
    
    return endpoint;
  }

  private static parseHeaders(headers?: PostmanHeader[]): Record<string, string> {
    if (!headers) return {};
    
    const result: Record<string, string> = {};
    headers
      .filter(h => !h.disabled)
      .forEach(h => {
        result[h.key] = h.value;
      });
    
    return result;
  }

  private static parseBody(body?: PostmanBody): any {
    if (!body) return undefined;
    
    switch (body.mode) {
      case 'raw':
        try {
          return JSON.parse(body.raw || '');
        } catch {
          return body.raw;
        }
      case 'formdata':
      case 'urlencoded':
        const obj: Record<string, any> = {};
        (body as any)[body.mode]?.forEach((item: any) => {
          if (!item.disabled) {
            obj[item.key] = item.value;
          }
        });
        return obj;
      default:
        return undefined;
    }
  }

  private static parseTestScript(events?: PostmanEvent[]): Assertion[] {
    const testEvent = events?.find(e => e.listen === 'test');
    if (!testEvent) return [];

    const assertions: Assertion[] = [];
    const script = testEvent.script.exec.join('\n');

    // Parse common Postman test patterns
    const statusCodeMatch = script.match(/pm\.response\.to\.have\.status\((\d+)\)/);
    if (statusCodeMatch) {
      assertions.push({
        type: 'statusCode',
        expected: parseInt(statusCodeMatch[1])
      });
    }

    const jsonExistsMatches = script.matchAll(/pm\.expect\(jsonData\.([^)]+)\)\.to\.exist/g);
    for (const match of jsonExistsMatches) {
      assertions.push({
        type: 'exists',
        jsonPath: `$.${match[1]}`
      });
    }

    const equalsMatches = script.matchAll(/pm\.expect\(jsonData\.([^)]+)\)\.to\.(?:equal|eql)\(([^)]+)\)/g);
    for (const match of equalsMatches) {
      let expected: any = match[2];
      try {
        expected = JSON.parse(match[2]);
      } catch {
        expected = match[2].replace(/['"]/g, '');
      }
      assertions.push({
        type: 'equals',
        jsonPath: `$.${match[1]}`,
        expected
      });
    }

    return assertions;
  }

  private static parsePreRequestScript(events?: PostmanEvent[]): any[] {
    const preRequestEvent = events?.find(e => e.listen === 'prerequest');
    if (!preRequestEvent) return [];

    const preProcess: any[] = [];
    const script = preRequestEvent.script.exec.join('\n');

    // Parse common pre-request patterns
    if (script.includes('Math.random()')) {
      preProcess.push({
        var: 'randomId',
        function: 'faker.uuid'
      });
    }

    if (script.includes('Date.now()')) {
      preProcess.push({
        var: 'timestamp',
        function: 'date.now'
      });
    }

    return preProcess;
  }

  private static generateDefaultAssertions(method: string): Assertion[] {
    const assertions: Assertion[] = [];
    
    switch (method.toUpperCase()) {
      case 'GET':
        assertions.push(
          { type: 'statusCode', expected: 200 },
          { type: 'exists', jsonPath: '$' }
        );
        break;
      case 'POST':
        assertions.push(
          { type: 'statusCode', expected: 201 }
        );
        break;
      case 'PUT':
      case 'PATCH':
        assertions.push(
          { type: 'statusCode', expected: 200 }
        );
        break;
      case 'DELETE':
        assertions.push(
          { type: 'statusCode', expected: 204 }
        );
        break;
      default:
        assertions.push(
          { type: 'statusCode', expected: 200 }
        );
    }
    
    return assertions;
  }

  private static generateTestScenarios(baseTestData: TestData, item: PostmanItem): TestData[] {
    const scenarios: TestData[] = [baseTestData];

    // Add negative test cases based on method
    switch (baseTestData.method) {
      case 'GET':
        if (baseTestData.headers?.Authorization) {
          const unauthorizedHeaders = { ...baseTestData.headers };
          delete unauthorizedHeaders.Authorization;
          scenarios.push({
            ...baseTestData,
            name: `${baseTestData.name} - Unauthorized`,
            headers: unauthorizedHeaders,
            assertions: [{ type: 'statusCode', expected: 401 }]
          });
        }
        break;
        
      case 'POST':
      case 'PUT':
      case 'PATCH':
        if (baseTestData.body) {
          scenarios.push({
            ...baseTestData,
            name: `${baseTestData.name} - Invalid Data`,
            body: {},
            assertions: [{ type: 'statusCode', expected: 400 }]
          });
        }
        break;
    }

    return scenarios;
  }
}