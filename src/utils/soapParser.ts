import { TestSuite, TestCase, TestData, Assertion } from '../types';

export interface ParsedSoapRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  soapAction?: string;
  operation?: string;
}

export interface SoapParseResult {
  success: boolean;
  testSuite?: TestSuite;
  error?: string;
}

export class SoapParser {
  static parseFromWsdl(wsdlUrl: string, operation: string): SoapParseResult {
    try {
      // For now, create a basic SOAP template
      const parsed: ParsedSoapRequest = {
        method: 'POST',
        url: wsdlUrl.replace('?wsdl', ''),
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"${operation}"`
        },
        body: this.generateSoapEnvelope(operation),
        soapAction: operation,
        operation
      };
      
      const testSuite = this.convertToTestSuite(parsed);
      return { success: true, testSuite };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  static parseFromXml(xmlBody: string, serviceUrl: string, soapAction?: string): SoapParseResult {
    try {
      const operation = this.extractOperationFromXml(xmlBody);
      const parsed: ParsedSoapRequest = {
        method: 'POST',
        url: serviceUrl,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          ...(soapAction && { 'SOAPAction': `"${soapAction}"` })
        },
        body: xmlBody,
        soapAction,
        operation
      };
      
      const testSuite = this.convertToTestSuite(parsed);
      return { success: true, testSuite };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  private static extractOperationFromXml(xml: string): string {
    const operationMatch = xml.match(/<(\w+)\s+xmlns/);
    return operationMatch ? operationMatch[1] : 'SoapOperation';
  }

  private static generateSoapEnvelope(operation: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header/>
  <soap:Body>
    <${operation} xmlns="http://tempuri.org/">
      <!-- Add your parameters here -->
    </${operation}>
  </soap:Body>
</soap:Envelope>`;
  }

  private static convertToTestSuite(parsed: ParsedSoapRequest): TestSuite {
    const urlObj = new URL(parsed.url);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    const endpoint = urlObj.pathname;
    
    const testData: TestData[] = [
      {
        name: 'Valid SOAP Request',
        method: parsed.method,
        endpoint,
        headers: parsed.headers,
        preProcess: [],
        body: parsed.body,
        assertions: this.generateSoapAssertions()
      }
    ];

    // Add fault test case
    testData.push({
      name: 'Invalid SOAP Request',
      method: parsed.method,
      endpoint,
      headers: parsed.headers,
      preProcess: [],
      body: this.generateInvalidSoapEnvelope(),
      assertions: [
        { type: 'statusCode', expected: 500 },
        { type: 'contains', xpathExpression: '//soap:Fault', expected: 'soap:Fault' }
      ]
    });

    const testCase: TestCase = {
      name: `SOAP ${parsed.operation || 'Service'}`,
      type: 'SOAP',
      testData,
      testSteps: []
    };

    return {
      id: `soap-${Date.now()}`,
      suiteName: `SOAP Import - ${parsed.operation || urlObj.hostname}`,
      applicationName: urlObj.hostname,
      type: 'API',
      baseUrl,
      testCases: [testCase]
    };
  }

  private static generateSoapAssertions(): Assertion[] {
    return [
      { type: 'statusCode', expected: 200 },
      { type: 'contains', xpathExpression: '//soap:Envelope', expected: 'soap:Envelope' },
      { type: 'exists', xpathExpression: '//soap:Body' }
    ];
  }

  private static generateInvalidSoapEnvelope(): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <InvalidOperation/>
  </soap:Body>
</soap:Envelope>`;
  }
}