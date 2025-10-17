import { TestSuite, TestCase, TestData, Assertion } from '../types';

export interface ParsedCurlRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: any;
  queryParams?: Record<string, string>;
}

export interface CurlParseResult {
  success: boolean;
  testSuite?: TestSuite;
  error?: string;
}

export class CurlParser {
  static parse(curlCommand: string): CurlParseResult {
    try {
      const parsed = this.parseCurlCommand(curlCommand);
      const testSuite = this.convertToTestSuite(parsed);
      return { success: true, testSuite };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private static parseCurlCommand(curl: string): ParsedCurlRequest {
    const trimmed = curl.trim().replace(/^curl\s+/, '');
    
    let method = 'GET';
    let url = '';
    const headers: Record<string, string> = {};
    let body: any = null;
    
    // Extract method
    const methodMatch = trimmed.match(/-X\s+['"]?(\w+)['"]?/i);
    if (methodMatch) {
      method = methodMatch[1].toUpperCase();
    }
    
    // Extract URL - handle HTML entities and various formats
    let urlMatch = trimmed.match(/(?:--location\s+)?['"]?([^'"\s]*(?:https?|ftp):\/\/[^'"\s]*)['"]?/);
    if (urlMatch) {
      url = urlMatch[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'");
    }
    
    // Extract headers
    const headerMatches = trimmed.matchAll(/-H\s+['"]?([^'"\n]+)['"]?/g);
    for (const match of headerMatches) {
      const headerStr = match[1];
      const colonIndex = headerStr.indexOf(':');
      if (colonIndex > 0) {
        const key = headerStr.substring(0, colonIndex).trim();
        const value = headerStr.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }
    
    // Extract body data - support both -d and --data flags
    const bodyMatch = trimmed.match(/(?:-d|--data)\s+['"]?([\s\S]*?)['"]?(?:\s+--|$)/);
    if (bodyMatch) {
      let bodyStr = bodyMatch[1];
      // Decode HTML entities
      bodyStr = bodyStr.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      try {
        body = JSON.parse(bodyStr);
      } catch {
        body = bodyStr;
      }
      // If data is present and no explicit method, default to POST
      if (!methodMatch) {
        method = 'POST';
      }
    }
    
    return { method, url, headers, body };
  }

  private static convertToTestSuite(parsed: ParsedCurlRequest): TestSuite {
    const urlObj = new URL(parsed.url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const endpoint = urlObj.pathname + urlObj.search;
    
    const testData: TestData[] = [
      {
        name: 'Valid Request',
        method: parsed.method,
        endpoint,
        headers: parsed.headers,
        ...(parsed.body && { body: parsed.body }),
        assertions: this.generateAssertions(parsed.method)
      }
    ];

    // Add negative test cases
    if (parsed.headers.Authorization) {
      const { Authorization, ...headersWithoutAuth } = parsed.headers;
      testData.push({
        name: 'Unauthorized Request',
        method: parsed.method,
        endpoint,
        headers: headersWithoutAuth,
        ...(parsed.body && { body: parsed.body }),
        assertions: [{ type: 'statusCode', expected: 401 }]
      });
    }

    const testCase: TestCase = {
      name: `${parsed.method} ${urlObj.pathname}`,
      type: 'REST',
      testData,
      testSteps: []
    };

    return {
      id: `curl-${Date.now()}`,
      suiteName: `cURL Import - ${urlObj.hostname}`,
      applicationName: urlObj.hostname,
      type: 'API',
      baseUrl,
      testCases: [testCase]
    };
  }

  private static generateAssertions(method: string): Assertion[] {
    const assertions: Assertion[] = [];
    
    switch (method) {
      case 'GET':
        assertions.push(
          { type: 'statusCode', expected: 200 },
          { type: 'exists', jsonPath: '$' }
        );
        break;
      case 'POST':
        assertions.push(
          { type: 'statusCode', expected: 201 },
          { type: 'exists', jsonPath: '$.id' }
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
}