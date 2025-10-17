import axios from 'axios';
import { Ajv } from 'ajv';
import { Reporter } from "./reporter";
import { assertJson, assertXPath } from "./utils/assertUtils";
import { loadRequestBody } from "./utils/loadRequestBody";
import { TestSuite } from "./types";
import { loadEnvironment } from "./utils/envManager";
import { injectVariables, storeResponseVariables, clearLocalVariables } from "./utils/variableStore";
import { runPreProcessors } from "./preProcessor";
import { loadSchema } from "./utils/loadSchema";
import {UIRunner} from "./ui-test";
import {Logger} from "./utils/Logger";
import { loadParameterData, injectParametersInObject, ParameterSet } from "./utils/parameterProcessor";

// Console colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};

const ajv = new Ajv();

function isSoapRequest(headers?: Record<string, string>): boolean {
    const ct = headers?.['Content-Type']?.toLowerCase();
    return (
        ct?.includes('text/xml') ||
        ct?.includes('application/soap+xml') ||
        !!headers?.['SOAPAction']
    );
}

export async function executeSuite(suite: TestSuite, reporter: Reporter) {
    Logger.box(`🎯 EXECUTING TEST SUITE`, `Suite: ${suite.suiteName}\nType: ${suite.type || 'API'}\nBase URL: ${suite.baseUrl}\nTest Cases: ${suite.testCases.length}`, colors.magenta);

    if(suite?.type === 'UI'){
        await runUITests(suite, reporter);
    }else {
        await runAPITests(suite, reporter);
    }
}

export async function runUITests(suite: TestSuite, reporter: Reporter) {
    const runner = new UIRunner(reporter);
    const orderedTestCases = resolveDependencies(suite.testCases);
    const executedTestCases = new Set<string>();
    const failedTestCases = new Set<string>();
    
    for (const testCase of orderedTestCases) {
        // Skip disabled test cases
        if (testCase.enabled === false) {
            Logger.warning(`Skipping disabled UI test case: ${testCase.name}`);
            continue;
        }
        
        Logger.section('🎭', `UI TEST CASE: ${testCase.name}`, colors.blue);
        
        // Check if dependencies are satisfied
        if (testCase.dependsOn) {
            const unsatisfiedDeps = testCase.dependsOn.filter((dep: string) => !executedTestCases.has(dep));
            const failedDeps = testCase.dependsOn.filter((dep: string) => failedTestCases.has(dep));
            
            if (unsatisfiedDeps.length > 0 || failedDeps.length > 0) {
                const errorMsg = unsatisfiedDeps.length > 0 ? 
                    `Unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}` :
                    `Dependent test cases failed: ${failedDeps.join(', ')}`;
                    
                Logger.error(`Skipping ${testCase.name} - ${errorMsg}`);
                reporter.add({
                    testCase: testCase.name,
                    dataSet: 'UI Steps',
                    status: 'FAIL',
                    error: errorMsg,
                    responseTimeMs: 0,
                    assertionsPassed: 0,
                    assertionsFailed: 1,
                });
                failedTestCases.add(testCase.name);
                continue;
            }
            
            Logger.success(`Dependencies satisfied for ${testCase.name}: ${testCase.dependsOn.join(', ')}`);
        }
        
        try {
            await runner.init();
            await runner.runTestCase(testCase);
            await runner.close();
            executedTestCases.add(testCase.name);
            Logger.success(`UI test case ${testCase.name} completed successfully`);
        } catch (error) {
            failedTestCases.add(testCase.name);
            Logger.error(`UI test case ${testCase.name} failed - dependent tests will be skipped`);
            await runner.close();
        } finally {
            // Clear local variables after test case completion
            clearLocalVariables();
        }
    }
}


export async function runAPITests(suite: TestSuite, reporter: Reporter){
    const env = loadEnvironment();
    const resolvedBaseUrl = env[suite.baseUrl] || suite.baseUrl || env.BASE_URL || '';
    
    // Sort test cases by dependencies and priority
    const orderedTestCases = resolveDependencies(suite.testCases);
    const executedTestCases = new Set<string>();
    const failedTestCases = new Set<string>();
    
    for (const testCase of orderedTestCases) {
        // Skip disabled test cases
        if (testCase.enabled === false) {
            Logger.warning(`Skipping disabled API test case: ${testCase.name}`);
            continue;
        }
        
        Logger.section('🔧', `API TEST CASE: ${testCase.name}`, colors.green);
        
        // Check if dependencies are satisfied
        if (testCase.dependsOn) {
            const unsatisfiedDeps = testCase.dependsOn.filter((dep: string) => !executedTestCases.has(dep));
            const failedDeps = testCase.dependsOn.filter((dep: string) => failedTestCases.has(dep));
            
            if (unsatisfiedDeps.length > 0) {
                Logger.warning(`Skipping ${testCase.name} - waiting for dependencies: ${unsatisfiedDeps.join(', ')}`);
                reporter.add({
                    testCase: testCase.name,
                    dataSet: 'Dependency Check',
                    status: 'FAIL',
                    error: `Unsatisfied dependencies: ${unsatisfiedDeps.join(', ')}`,
                    responseTimeMs: 0,
                    assertionsPassed: 0,
                    assertionsFailed: 1,
                });
                failedTestCases.add(testCase.name);
                continue;
            }
            
            if (failedDeps.length > 0) {
                Logger.error(`Skipping ${testCase.name} - dependent test cases failed: ${failedDeps.join(', ')}`);
                reporter.add({
                    testCase: testCase.name,
                    dataSet: 'Dependency Check',
                    status: 'FAIL',
                    error: `Dependent test cases failed: ${failedDeps.join(', ')}`,
                    responseTimeMs: 0,
                    assertionsPassed: 0,
                    assertionsFailed: 1,
                });
                failedTestCases.add(testCase.name);
                continue;
            }
            
            Logger.success(`Dependencies satisfied for ${testCase.name}: ${testCase.dependsOn.join(', ')}`);
        }

        let testCaseFailed = false;
        
        // Load parameter data if parameters are enabled
        let parameterSets: ParameterSet[] = [{}];
        if (testCase.parameters?.enabled && testCase.parameters.dataSource) {
            try {
                parameterSets = loadParameterData(testCase.parameters.dataSource);
                if (parameterSets.length === 0) {
                    parameterSets = [{}];
                }
                Logger.info(`Loaded ${parameterSets.length} parameter sets for test case: ${testCase.name}`);
            } catch (error: any) {
                Logger.error(`Failed to load parameters: ${error.message}`);
                parameterSets = [{}];
            }
        }
        
        // If parameters are enabled and no testData, create default testData from test case
        let testDataToExecute = testCase.testData;
        if (testCase.parameters?.enabled && testCase.testData.length === 0) {
            testDataToExecute = [{
                name: testCase.name,
                method: testCase.method,
                endpoint: testCase.endpoint,
                headers: testCase.headers,
                cookies: testCase.cookies,
                body: testCase.body,
                bodyFile: testCase.bodyFile,
                assertions: testCase.assertions,
                store: testCase.store,
                localStore: testCase.localStore,
                preProcess: testCase.preProcess,
                responseSchema: testCase.responseSchema,
                responseSchemaFile: testCase.responseSchemaFile
            }];
        }
        
        for (const data of testDataToExecute) {
            // Skip disabled test data
            if (data.enabled === false) {
                Logger.warning(`Skipping disabled test data: ${data.name}`);
                continue;
            }
            
            // Execute test data for each parameter set
            for (let paramIndex = 0; paramIndex < parameterSets.length; paramIndex++) {
                const parameters = parameterSets[paramIndex];
                const parameterSuffix = parameterSets.length > 1 ? ` [Param Set ${paramIndex + 1}]` : '';
                
                const start = Date.now();
                let responseData: any = null;
                
                // Inject parameters into test data
                const parameterizedData = injectParametersInObject(data, parameters);
                const fullUrl = injectVariables(resolvedBaseUrl + parameterizedData.endpoint);
                let headers = parameterizedData.headers;
                let cookies = parameterizedData.cookies;
                const soap = isSoapRequest(headers);

            if (parameterizedData.preProcess) await runPreProcessors(parameterizedData.preProcess);

            Logger.section('📡', `TEST DATA: ${parameterizedData.name}${parameterSuffix}`, colors.cyan);
            
            if (parameterSets.length > 1) {
                console.log(`${colors.magenta}🔢 PARAMETERS${colors.reset}`);
                Object.entries(parameters).forEach(([key, value]) => {
                    console.log(`  ${key}: ${value}`);
                });
            }
            console.log(`${colors.blue}🌐 REQUEST DETAILS${colors.reset}`);
            console.log(`  Method: ${parameterizedData.method}`);
            console.log(`  URL: ${fullUrl}`);
            console.log(`  Type: ${soap ? 'SOAP' : 'REST'}`);
            
            let body: any;
            try {
                body = loadRequestBody(parameterizedData.bodyFile, parameterizedData.body, soap);
                
                if (body) {
                    console.log(`${colors.yellow}📄 Request Body:${colors.reset}`);
                    console.log(JSON.stringify(body, null, 2));
                }
            } catch (err: any) {
                reporter.add({
                    testCase: testCase.name,
                    dataSet: `${parameterizedData.name}${parameterSuffix}`,
                    status: 'FAIL',
                    error: `Failed to load body: ${err.message}`,
                    responseTimeMs: 0,
                    assertionsPassed: 0,
                    assertionsFailed: 0,
                });
                continue;
            }

            let schema: object | undefined;
            if (!soap && parameterizedData.responseSchemaFile) {
                try {
                    schema = loadSchema(parameterizedData.responseSchemaFile);
                } catch (err: any) {
                    reporter.add({
                        testCase: testCase.name,
                        dataSet: `${parameterizedData.name}${parameterSuffix}`,
                        status: 'FAIL',
                        error: `Failed to load schema: ${err.message}`,
                        responseTimeMs: 0,
                        assertionsPassed: 0,
                        assertionsFailed: 0,
                    });
                    continue;
                }
            } else if (parameterizedData.responseSchema) {
                schema = parameterizedData.responseSchema;
            }

            let passed = 0, failed = 0;
            let status: 'PASS' | 'FAIL' = 'PASS';
            const allErrors: string[] = [];
            const apiDetails: any = {
                method: parameterizedData.method,
                endpoint: parameterizedData.endpoint,
                fullUrl: fullUrl,
                requestHeaders: headers,
                requestBody: body,
                responseStatus: null,
                responseHeaders: null,
                responseBody: null,
                executionTimeMs: 0,
                assertions: [],
                variableStorage: null,
                parameters: parameterSets.length > 1 ? parameters : undefined
            };

            try {
                headers = injectVariableInHeaders(headers || {});
                cookies = injectVariableInHeaders(cookies || {});
                apiDetails.requestHeaders = headers;
                apiDetails.requestCookies = cookies;
                
                if (Object.keys(headers).length > 0) {
                    console.log(`${colors.magenta}📋 Headers:${colors.reset}`);
                    Object.entries(headers).forEach(([key, value]) => {
                        console.log(`  ${key}: ${value}`);
                    });
                }
                
                if (Object.keys(cookies).length > 0) {
                    console.log(`${colors.magenta}🍪 Cookies:${colors.reset}`);
                    Object.entries(cookies).forEach(([key, value]) => {
                        console.log(`  ${key}: ${value}`);
                    });
                }
                
                Logger.request(parameterizedData.method, fullUrl);
                
                // Convert cookies to Cookie header if cookies exist
                if (cookies && Object.keys(cookies).length > 0) {
                    const cookieString = Object.entries(cookies)
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ');
                    headers = { ...headers, 'Cookie': cookieString };
                }
                
                const res = await axios({
                    url: fullUrl,
                    method: parameterizedData.method.toLowerCase(),
                    headers,
                    data: body,
                });

                responseData = res.data;
                apiDetails.responseStatus = res.status;
                apiDetails.responseHeaders = res.headers;
                apiDetails.responseBody = responseData;
                
                Logger.success(`Request completed with status ${res.status}`);
                console.log(`${colors.green}📥 RESPONSE${colors.reset}`);
                console.log(`  Status: ${res.status}`);
                console.log(`  Time: ${Date.now() - start}ms`);
                
                console.log(`${colors.cyan}📄 Response Body:${colors.reset}`);
                console.log(JSON.stringify(responseData, null, 2));

                if (!soap && schema) {
                    Logger.info('Validating response schema...');
                    const validate = ajv.compile(schema);
                    
                    if (!validate(res.data)) {
                        failed++;
                        const schemaError = `Schema validation failed: ${validate.errors?.map(e => `${e.instancePath} ${e.message}`).join('; ')}`;
                        allErrors.push(schemaError);
                        Logger.error('Schema validation failed');
                        apiDetails.schemaValidation = { status: 'FAIL', error: schemaError };
                    } else {
                        Logger.success('Schema validation passed');
                        apiDetails.schemaValidation = { status: 'PASS' };
                    }
                }

                // Run assertions
                if (parameterizedData.assertions && parameterizedData.assertions.length > 0) {
                    Logger.section('🔍', 'RUNNING ASSERTIONS', colors.yellow);
                }
                
                for (const assertion of parameterizedData.assertions || []) {
                    const assertionDesc = `${assertion.type} assertion (${assertion.jsonPath || assertion.xpathExpression || 'N/A'})`;
                    Logger.info(`Running ${assertionDesc}`);
                    
                    try {
                        if (soap) {
                            assertXPath(res.data, assertion);
                        } else {
                            assertJson(res.data, res.status, [assertion]);
                        }
                        passed++;
                        Logger.success(`${assertionDesc} passed`);
                        
                        apiDetails.assertions.push({
                            type: assertion.type,
                            jsonPath: assertion.jsonPath || assertion.xpathExpression,
                            expected: assertion.expected,
                            status: 'PASS'
                        });
                    } catch (e: any) {
                        failed++;
                        allErrors.push(e.message);
                        Logger.error(`${assertionDesc} failed: ${e.message}`);
                        
                        apiDetails.assertions.push({
                            type: assertion.type,
                            jsonPath: assertion.jsonPath || assertion.xpathExpression,
                            expected: assertion.expected,
                            status: 'FAIL',
                            error: e.message
                        });
                    }
                }

                // Variable storage
                if (parameterizedData.store && Object.keys(parameterizedData.store).length > 0) {
                    Logger.section('💾', 'STORING GLOBAL VARIABLES', colors.magenta);
                    
                    try {
                        storeResponseVariables(res.data, parameterizedData.store, false, res.headers);
                        Logger.info(`Global variables stored: ${Object.keys(parameterizedData.store).join(', ')}`);
                        
                        apiDetails.variableStorage = {
                            variables: Object.keys(parameterizedData.store),
                            status: 'PASS'
                        };
                    } catch (err: any) {
                        failed++;
                        const storeError = `Variable store failed: ${err.message}`;
                        allErrors.push(storeError);
                        Logger.error(`Variable storage failed: ${err.message}`);
                        
                        apiDetails.variableStorage = {
                            variables: Object.keys(parameterizedData.store),
                            status: 'FAIL',
                            error: storeError
                        };
                    }
                }

                // Local variable storage
                if (parameterizedData.localStore && Object.keys(parameterizedData.localStore).length > 0) {
                    Logger.section('💾', 'STORING LOCAL VARIABLES', colors.magenta);
                    
                    try {
                        storeResponseVariables(res.data, parameterizedData.localStore, true, res.headers);
                        Logger.info(`Local variables stored: ${Object.keys(parameterizedData.localStore).join(', ')}`);
                        
                        apiDetails.localVariableStorage = {
                            variables: Object.keys(parameterizedData.localStore),
                            status: 'PASS'
                        };
                    } catch (err: any) {
                        failed++;
                        const storeError = `Local variable store failed: ${err.message}`;
                        allErrors.push(storeError);
                        Logger.error(`Local variable storage failed: ${err.message}`);
                        
                        apiDetails.localVariableStorage = {
                            variables: Object.keys(parameterizedData.localStore),
                            status: 'FAIL',
                            error: storeError
                        };
                    }
                }

                if (failed > 0) status = 'FAIL';

            } catch (err: any) {
                if (axios.isAxiosError(err) && err.response) {
                    const res = err.response;
                    responseData = res.data;
                    apiDetails.responseStatus = res.status;
                    apiDetails.responseHeaders = res.headers;
                    apiDetails.responseBody = responseData;
                    
                    Logger.warning(`Request failed with status ${res.status}`);
                    console.log(`${colors.red}📥 ERROR RESPONSE${colors.reset}`);
                    console.log(`  Status: ${res.status}`);
                    console.log(`  Time: ${Date.now() - start}ms`);
                    console.log(`${colors.cyan}📄 Error Response Body:${colors.reset}`);
                    console.log(JSON.stringify(responseData, null, 2));

                    // Still run assertions on error response
                    for (const assertion of parameterizedData.assertions || []) {
                        const assertionDesc = `${assertion.type} assertion (${assertion.jsonPath || assertion.xpathExpression || 'N/A'})`;
                        console.log(`➡️ Running ${assertionDesc} on error response`);
                        
                        try {
                            if (soap) {
                                assertXPath(res.data, assertion);
                            } else {
                                assertJson(res.data, res.status, [assertion]);
                            }
                            passed++;
                            console.log(`✅ ${assertionDesc} passed`);
                            
                            apiDetails.assertions.push({
                                type: assertion.type,
                                jsonPath: assertion.jsonPath || assertion.xpathExpression,
                                expected: assertion.expected,
                                status: 'PASS'
                            });
                        } catch (e: any) {
                            failed++;
                            allErrors.push(e.message);
                            console.log(`❌ ${assertionDesc} failed: ${e.message}`);
                            
                            apiDetails.assertions.push({
                                type: assertion.type,
                                jsonPath: assertion.jsonPath || assertion.xpathExpression,
                                expected: assertion.expected,
                                status: 'FAIL',
                                error: e.message
                            });
                        }
                    }

                    if (parameterizedData.store) {
                        console.log(`➡️ Storing global variables from error response...`);
                        
                        try {
                            storeResponseVariables(res.data, parameterizedData.store, false, res.headers);
                            console.log(`✅ Global variables stored from error response`);
                            
                            apiDetails.variableStorage = {
                                variables: Object.keys(parameterizedData.store),
                                status: 'PASS'
                            };
                        } catch (err: any) {
                            failed++;
                            const storeError = `Variable store failed: ${err.message}`;
                            allErrors.push(storeError);
                            console.log(`❌ Variable storage failed: ${err.message}`);
                            
                            apiDetails.variableStorage = {
                                variables: Object.keys(parameterizedData.store),
                                status: 'FAIL',
                                error: storeError
                            };
                        }
                    }

                    if (parameterizedData.localStore) {
                        console.log(`➡️ Storing local variables from error response...`);
                        
                        try {
                            storeResponseVariables(res.data, parameterizedData.localStore, true, res.headers);
                            console.log(`✅ Local variables stored from error response`);
                            
                            apiDetails.localVariableStorage = {
                                variables: Object.keys(parameterizedData.localStore),
                                status: 'PASS'
                            };
                        } catch (err: any) {
                            failed++;
                            const storeError = `Local variable store failed: ${err.message}`;
                            allErrors.push(storeError);
                            console.log(`❌ Local variable storage failed: ${err.message}`);
                            
                            apiDetails.localVariableStorage = {
                                variables: Object.keys(parameterizedData.localStore),
                                status: 'FAIL',
                                error: storeError
                            };
                        }
                    }

                    if (failed > 0) status = 'FAIL';

                } else {
                    status = 'FAIL';
                    const requestError = `Request error: ${err.message}`;
                    allErrors.push(requestError);
                    console.log(`❌ Request completely failed: ${err.message}`);
                    apiDetails.requestError = requestError;
                }
            } finally {
                const end = Date.now();
                apiDetails.executionTimeMs = end - start;
                
                reporter.add({
                    testCase: testCase.name,
                    dataSet: `${parameterizedData.name}${parameterSuffix}`,
                    status,
                    error: allErrors.length ? allErrors.join(' | ') : undefined,
                    assertionsPassed: passed,
                    assertionsFailed: failed,
                    responseTimeMs: end - start,
                    responseBody: responseData,
                    apiDetails: apiDetails // Add API-specific details
                });
                
                if (status === 'FAIL') {
                    testCaseFailed = true;
                }
            }
            }
        }
        
        // Clear local variables after test case completion
        clearLocalVariables();
        
        // Mark test case as executed or failed
        if (testCaseFailed) {
            failedTestCases.add(testCase.name);
            Logger.error(`Test case ${testCase.name} failed - dependent tests will be skipped`);
        } else {
            executedTestCases.add(testCase.name);
            Logger.success(`Test case ${testCase.name} completed successfully`);
        }
    }
}

// Dependency resolution function
function resolveDependencies(testCases: any[]): any[] {
    const testCaseMap = new Map(testCases.map(tc => [tc.name, tc]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const result: any[] = [];
    
    function visit(testCaseName: string) {
        if (visiting.has(testCaseName)) {
            throw new Error(`Circular dependency detected involving: ${testCaseName}`);
        }
        
        if (visited.has(testCaseName)) {
            return;
        }
        
        const testCase = testCaseMap.get(testCaseName);
        if (!testCase) {
            throw new Error(`Test case not found: ${testCaseName}`);
        }
        
        visiting.add(testCaseName);
        
        // Visit dependencies first
        if (testCase.dependsOn) {
            for (const dep of testCase.dependsOn) {
                visit(dep);
            }
        }
        
        visiting.delete(testCaseName);
        visited.add(testCaseName);
        result.push(testCase);
    }
    
    // Sort by priority first (lower number = higher priority)
    const sortedByPriority = [...testCases].sort((a, b) => (a.priority || 999) - (b.priority || 999));
    
    // Visit all test cases to resolve dependencies
    for (const testCase of sortedByPriority) {
        if (!visited.has(testCase.name)) {
            visit(testCase.name);
        }
    }
    
    console.log(`${colors.blue}🔄 EXECUTION ORDER${colors.reset}`);
    console.log(`  ${result.map(tc => tc.name).join(' → ')}`);
    return result;
}

export function injectVariableInHeaders(headers: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        result[key] = injectVariables(value);
    }

    return result;
}
