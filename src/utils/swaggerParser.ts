export interface SwaggerSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths: Record<string, Record<string, SwaggerOperation>>;
  components?: {
    schemas?: Record<string, any>;
  };
  definitions?: Record<string, any>;
}

export interface SwaggerOperation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Array<{
    name: string;
    in: 'query' | 'header' | 'path' | 'formData' | 'body';
    required?: boolean;
    type?: string;
    schema?: any;
  }>;
  requestBody?: {
    content: Record<string, { schema: any }>;
    required?: boolean;
  };
  responses: Record<string, {
    description: string;
    schema?: any;
    content?: Record<string, { schema: any }>;
  }>;
}

export class SwaggerParser {
  private generateId(title: string): string {
    return `swagger-${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
  }

  private getBaseUrl(spec: SwaggerSpec): string {
    if (spec.servers && spec.servers.length > 0) {
      return spec.servers[0].url;
    }
    
    if (spec.host) {
      const scheme = spec.schemes?.[0] || 'https';
      const basePath = spec.basePath || '';
      return `${scheme}://${spec.host}${basePath}`;
    }
    
    return 'https://api.example.com';
  }

  private generateExampleFromSchema(schema: any): any {
    if (!schema) return {};
    
    if (schema.example) return schema.example;
    
    switch (schema.type) {
      case 'string':
        return schema.enum ? schema.enum[0] : '{{faker.name}}';
      case 'number':
      case 'integer':
        return 123;
      case 'boolean':
        return true;
      case 'array':
        return schema.items ? [this.generateExampleFromSchema(schema.items)] : [];
      case 'object':
        if (schema.properties) {
          const obj: any = {};
          Object.keys(schema.properties).forEach(key => {
            obj[key] = this.generateExampleFromSchema(schema.properties[key]);
          });
          return obj;
        }
        return {};
      default:
        return null;
    }
  }

  private getContentType(operation: SwaggerOperation): string {
    if (operation.requestBody?.content) {
      const contentTypes = Object.keys(operation.requestBody.content);
      return contentTypes.includes('application/json') ? 'application/json' : contentTypes[0];
    }
    return 'application/json';
  }

  private generateAssertions(responses: Record<string, any>): Array<any> {
    const assertions = [];
    
    // Get the first successful response code
    const successCode = Object.keys(responses).find(code => 
      code.startsWith('2') || code === 'default'
    );
    
    if (successCode && successCode !== 'default') {
      assertions.push({
        type: 'statusCode',
        expected: parseInt(successCode)
      });
    } else {
      assertions.push({
        type: 'statusCode',
        expected: 200
      });
    }
    
    // Add basic response validation
    assertions.push({
      type: 'exists',
      jsonPath: '$'
    });
    
    return assertions;
  }

  private generateTestData(path: string, method: string, operation: SwaggerOperation): any {
    const testData: any = {
      name: operation.summary || `${method.toUpperCase()} ${path}`,
      method: method.toUpperCase(),
      endpoint: path,
      headers: {}
    };

    // Set content type
    const contentType = this.getContentType(operation);
    if (contentType) {
      testData.headers['Content-Type'] = contentType;
    }

    // Handle request body
    if (operation.requestBody?.content) {
      const content = operation.requestBody.content[contentType];
      if (content?.schema) {
        testData.body = this.generateExampleFromSchema(content.schema);
      }
    }

    // Handle parameters (Swagger 2.0)
    if (operation.parameters) {
      const bodyParam = operation.parameters.find(p => p.in === 'body');
      if (bodyParam?.schema) {
        testData.body = this.generateExampleFromSchema(bodyParam.schema);
      }

      // Handle query parameters by adding them to endpoint
      const queryParams = operation.parameters.filter(p => p.in === 'query');
      if (queryParams.length > 0) {
        const params = queryParams.map(p => `${p.name}={{${p.name}}}`).join('&');
        testData.endpoint += `?${params}`;
      }

      // Handle header parameters
      const headerParams = operation.parameters.filter(p => p.in === 'header');
      headerParams.forEach(p => {
        testData.headers[p.name] = `{{${p.name}}}`;
      });
    }

    // Generate assertions
    testData.assertions = this.generateAssertions(operation.responses);

    return testData;
  }

  public parseSwagger(swaggerSpec: SwaggerSpec): any {
    const baseUrl = this.getBaseUrl(swaggerSpec);
    const suiteName = `${swaggerSpec.info.title} API Test Suite`;
    
    const testSuite = {
      id: this.generateId(swaggerSpec.info.title),
      suiteName,
      applicationName: swaggerSpec.info.title.toLowerCase(),
      type: 'API',
      baseUrl,
      timeout: 30000,
      tags: [
        { source: '@swagger' },
        { version: swaggerSpec.info.version }
      ],
      testCases: [] as any[]
    };

    // Group operations by tags or paths
    const groupedOperations: Record<string, Array<{ path: string; method: string; operation: SwaggerOperation }>> = {};

    Object.entries(swaggerSpec.paths).forEach(([path, pathItem]) => {
      Object.entries(pathItem).forEach(([method, operation]) => {
        if (typeof operation === 'object' && operation.responses) {
          const tag = operation.tags?.[0] || 'Default';
          if (!groupedOperations[tag]) {
            groupedOperations[tag] = [];
          }
          groupedOperations[tag].push({ path, method, operation });
        }
      });
    });

    // Create test cases for each group
    Object.entries(groupedOperations).forEach(([tag, operations]) => {
      const testCase = {
        name: `${tag} Operations`,
        type: 'REST',
        testData: [] as any[],
        testSteps: []
      };

      operations.forEach(({ path, method, operation }) => {
        // Positive test case
        const positiveTest = this.generateTestData(path, method, operation);
        testCase.testData.push(positiveTest);

        // Add negative test cases for POST/PUT/PATCH
        if (['post', 'put', 'patch'].includes(method.toLowerCase())) {
          // Unauthorized test
          const unauthorizedTest = {
            ...positiveTest,
            name: `${operation.summary || `${method.toUpperCase()} ${path}`} - Unauthorized`,
            headers: { 'Content-Type': positiveTest.headers['Content-Type'] },
            assertions: [{ type: 'statusCode', expected: 401 }]
          };
          testCase.testData.push(unauthorizedTest);

          // Invalid data test
          if (positiveTest.body) {
            const invalidTest = {
              ...positiveTest,
              name: `${operation.summary || `${method.toUpperCase()} ${path}`} - Invalid Data`,
              body: {},
              assertions: [{ type: 'statusCode', expected: 400 }]
            };
            testCase.testData.push(invalidTest);
          }
        }

        // Add unauthorized test for GET/DELETE
        if (['get', 'delete'].includes(method.toLowerCase())) {
          const unauthorizedTest = {
            ...positiveTest,
            name: `${operation.summary || `${method.toUpperCase()} ${path}`} - Unauthorized`,
            headers: { 'Accept': 'application/json' },
            assertions: [{ type: 'statusCode', expected: 401 }]
          };
          testCase.testData.push(unauthorizedTest);
        }
      });

      testSuite.testCases.push(testCase);
    });

    return testSuite;
  }
}