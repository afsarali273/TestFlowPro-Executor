import fs from 'fs';
import path from 'path';

interface SuiteReport {
    summary: {
        suiteName: string;
        runId?: string;
        tags?: { [key: string]: string };
        totalTestCases: number;
        totalDataSets: number;
        passed: number;
        failed: number;
        totalAssertionsPassed: number;
        totalAssertionsFailed: number;
        executionTimeMs: number;
    };
    results: {
        testCase: string;
        dataSet: string;
        status: 'PASS' | 'FAIL';
        error?: string;
        assertionsPassed?: number;
        assertionsFailed?: number;
        responseTimeMs?: number;
        responseBody?: any;
        stepResults?: {
            stepId: string;
            keyword: string;
            status: 'PASS' | 'FAIL' | 'SKIPPED';
            error?: string;
            screenshotPath?: string;
        }[];
        apiDetails?: any;
    }[];
}

export function generateHtmlReport(suites: SuiteReport[]): string {
    const totalSuites = suites.length;
    const totalPassed = suites.reduce((sum, s) => sum + s.summary.passed, 0);
    const totalFailed = suites.reduce((sum, s) => sum + s.summary.failed, 0);
    const totalTime = suites.reduce((sum, s) => sum + s.summary.executionTimeMs, 0);
    const overallStatus = totalFailed === 0 ? 'PASS' : 'FAIL';
    
    // Separate API and UI suites
    const apiSuites = suites.filter(s => s.results.some(r => r.apiDetails));
    const uiSuites = suites.filter(s => s.results.some(r => r.stepResults));
    const otherSuites = suites.filter(s => !s.results.some(r => r.apiDetails || r.stepResults));
    
    const generateSuiteRows = (suiteList: SuiteReport[], type: string) => {
        return suiteList.map(suite => {
            const { suiteName, tags, totalTestCases, passed, failed, totalAssertionsPassed, totalAssertionsFailed, executionTimeMs } = suite.summary;
            const statusBadge = failed > 0 ? 
                `<span class="badge fail">FAIL</span>` : 
                `<span class="badge pass">PASS</span>`;
            const serviceName = tags?.serviceName || tags?.['@serviceName'] || '';
            const suiteType = tags?.suiteType || tags?.['@suiteType'] || '';
            
            return `
                <tr class="${failed > 0 ? 'failed-row' : 'passed-row'}">
                    <td><span class="suite-type">${type}</span> ${suiteName}</td>
                    <td>${serviceName}</td>
                    <td>${suiteType}</td>
                    <td>${totalTestCases}</td>
                    <td class="pass-count">${passed}</td>
                    <td class="fail-count">${failed}</td>
                    <td>${totalAssertionsPassed} / ${totalAssertionsFailed}</td>
                    <td>${(executionTimeMs / 1000).toFixed(2)}s</td>
                    <td>${statusBadge}</td>
                </tr>`;
        }).join('');
    };
    
    const generateFailedDetails = () => {
        const failedResults = suites.flatMap(suite =>
            suite.results
                .filter(r => r.status === 'FAIL')
                .map(result => ({ suite, result }))
        );
        
        if (failedResults.length === 0) {
            return `<div class="no-failures">🎉 All tests passed successfully!</div>`;
        }
        
        return failedResults.map(({ suite, result }) => {
            const isAPI = !!result.apiDetails;
            const isUI = !!result.stepResults;
            const type = isAPI ? 'API' : isUI ? 'UI' : 'OTHER';
            
            let detailsHtml = '';
            
            if (isAPI && result.apiDetails) {
                const api = result.apiDetails;
                detailsHtml = `
                    <div class="api-details">
                        <h4>🔗 API Request Details</h4>
                        <div class="request-info">
                            <span class="method ${api.method?.toLowerCase()}">${api.method}</span>
                            <code>${api.fullUrl}</code>
                            <span class="status-code status-${Math.floor(api.responseStatus / 100)}xx">${api.responseStatus}</span>
                        </div>
                        ${api.assertions?.length ? `
                            <div class="assertions">
                                <h5>Assertions:</h5>
                                ${api.assertions.map((a: any) => `
                                    <div class="assertion ${a.status.toLowerCase()}">
                                        <span class="assertion-type">${a.type}</span>
                                        <code>${a.jsonPath}</code>
                                        ${a.expected !== undefined ? `<span class="expected">Expected: ${JSON.stringify(a.expected)}</span>` : ''}
                                        ${a.error ? `<div class="error-msg">${a.error}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                        ${result.responseBody ? `
                            <details class="response-body">
                                <summary>Response Body</summary>
                                <pre>${JSON.stringify(result.responseBody, null, 2)}</pre>
                            </details>
                        ` : ''}
                    </div>
                `;
            } else if (isUI && result.stepResults) {
                const failedSteps = result.stepResults.filter((s: any) => s.status === 'FAIL');
                const skippedSteps = result.stepResults.filter((s: any) => s.status === 'SKIPPED');
                detailsHtml = `
                    <div class="ui-details">
                        <h4>🖱️ UI Test Steps</h4>
                        ${failedSteps.map((step: any) => `
                            <div class="step-failure">
                                <div class="step-info">
                                    <span class="step-id">${step.stepId}</span>
                                    <span class="keyword">${step.keyword}</span>
                                    ${step.locator ? `<code>${step.locator.strategy}: ${step.locator.value}</code>` : ''}
                                </div>
                                ${step.error ? `<div class="error-msg">${step.error}</div>` : ''}
                                ${step.screenshotPath ? `
                                    <div class="screenshot">
                                        <a href="${step.screenshotPath}" target="_blank">📷 View Screenshot</a>
                                    </div>
                                ` : ''}
                            </div>
                        `).join('')}
                        ${skippedSteps.length > 0 ? `
                            <div class="skipped-steps">
                                <h5>⏭️ Skipped Steps (${skippedSteps.length})</h5>
                                ${skippedSteps.map((step: any) => `
                                    <div class="step-skipped">
                                        <span class="step-id">${step.stepId}</span>
                                        <span class="keyword">${step.keyword}</span>
                                        <span class="skip-reason">Skipped due to previous failure</span>
                                    </div>
                                `).join('')}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            return `
                <div class="failure-item">
                    <div class="failure-header">
                        <span class="test-type">${type}</span>
                        <h3>${suite.summary.suiteName} → ${result.testCase}</h3>
                        <span class="dataset">${result.dataSet}</span>
                    </div>
                    <div class="error-summary">${result.error || 'Test failed'}</div>
                    ${detailsHtml}
                </div>
            `;
        }).join('');
    };
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>TestFlow Pro - Test Report</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                line-height: 1.6; color: #333; background: #f8f9fa;
            }
            .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
            .header { 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white; padding: 30px; border-radius: 10px; margin-bottom: 30px;
                text-align: center;
            }
            .header h1 { font-size: 2.5em; margin-bottom: 10px; }
            .header .subtitle { opacity: 0.9; font-size: 1.1em; }
            .summary-cards { 
                display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px; margin-bottom: 30px;
            }
            .card { 
                background: white; padding: 20px; border-radius: 10px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center;
            }
            .card h3 { color: #666; font-size: 0.9em; text-transform: uppercase; margin-bottom: 10px; }
            .card .value { font-size: 2em; font-weight: bold; }
            .card.pass .value { color: #28a745; }
            .card.fail .value { color: #dc3545; }
            .card.time .value { color: #17a2b8; }
            .section { background: white; border-radius: 10px; padding: 20px; margin-bottom: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            .section h2 { color: #333; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #eee; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
            th { background: #f8f9fa; font-weight: 600; color: #666; }
            .suite-type { 
                background: #6c757d; color: white; padding: 2px 8px;
                border-radius: 12px; font-size: 0.8em; margin-right: 8px;
            }
            .badge { padding: 4px 12px; border-radius: 20px; font-size: 0.8em; font-weight: bold; }
            .badge.pass { background: #d4edda; color: #155724; }
            .badge.fail { background: #f8d7da; color: #721c24; }
            .pass-count { color: #28a745; font-weight: bold; }
            .fail-count { color: #dc3545; font-weight: bold; }
            .failed-row { background: #fff5f5; }
            .passed-row { background: #f0fff4; }
            .no-failures { 
                text-align: center; padding: 40px; font-size: 1.2em;
                color: #28a745; background: #d4edda; border-radius: 10px;
            }
            .failure-item { 
                border: 1px solid #dee2e6; border-radius: 8px;
                margin-bottom: 20px; overflow: hidden;
            }
            .failure-header { 
                background: #f8f9fa; padding: 15px;
                border-bottom: 1px solid #dee2e6;
            }
            .failure-header h3 { color: #dc3545; margin: 5px 0; }
            .test-type { 
                background: #6f42c1; color: white; padding: 2px 8px;
                border-radius: 12px; font-size: 0.8em;
            }
            .dataset { 
                background: #e9ecef; padding: 2px 8px;
                border-radius: 12px; font-size: 0.8em; color: #6c757d;
            }
            .error-summary { 
                background: #f8d7da; color: #721c24; padding: 10px 15px;
                border-left: 4px solid #dc3545;
            }
            .api-details, .ui-details { padding: 15px; }
            .request-info { 
                display: flex; align-items: center; gap: 10px;
                margin: 10px 0; flex-wrap: wrap;
            }
            .method { 
                padding: 4px 8px; border-radius: 4px; font-weight: bold;
                color: white; font-size: 0.8em;
            }
            .method.get { background: #28a745; }
            .method.post { background: #007bff; }
            .method.put { background: #ffc107; color: #333; }
            .method.delete { background: #dc3545; }
            .status-code { 
                padding: 4px 8px; border-radius: 4px; font-weight: bold;
                color: white; font-size: 0.8em;
            }
            .status-2xx { background: #28a745; }
            .status-4xx { background: #ffc107; color: #333; }
            .status-5xx { background: #dc3545; }
            .assertions { margin: 15px 0; }
            .assertion { 
                padding: 8px; margin: 5px 0; border-radius: 4px;
                border-left: 4px solid #ccc;
            }
            .assertion.pass { background: #d4edda; border-color: #28a745; }
            .assertion.fail { background: #f8d7da; border-color: #dc3545; }
            .assertion-type { 
                background: #6c757d; color: white; padding: 2px 6px;
                border-radius: 10px; font-size: 0.7em; margin-right: 8px;
            }
            .expected { color: #6c757d; font-size: 0.9em; }
            .error-msg { color: #dc3545; font-size: 0.9em; margin-top: 5px; }
            .step-failure { 
                border: 1px solid #dee2e6; border-radius: 4px;
                padding: 10px; margin: 10px 0;
            }
            .step-info { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
            .step-id { 
                background: #007bff; color: white; padding: 2px 6px;
                border-radius: 10px; font-size: 0.7em;
            }
            .keyword { 
                background: #6f42c1; color: white; padding: 2px 6px;
                border-radius: 10px; font-size: 0.7em;
            }
            .skipped-steps { 
                margin-top: 15px; padding: 10px; background: #fff3cd;
                border-radius: 4px; border-left: 4px solid #ffc107;
            }
            .skipped-steps h5 { color: #856404; margin-bottom: 10px; }
            .step-skipped { 
                display: flex; align-items: center; gap: 10px;
                padding: 5px 0; border-bottom: 1px solid #ffeaa7;
            }
            .step-skipped:last-child { border-bottom: none; }
            .skip-reason { 
                color: #856404; font-size: 0.8em; font-style: italic;
            }
            .screenshot a { 
                color: #007bff; text-decoration: none;
                background: #e3f2fd; padding: 5px 10px; border-radius: 4px;
                display: inline-block; margin-top: 5px;
            }
            .response-body { margin: 10px 0; }
            .response-body summary { 
                cursor: pointer; padding: 5px; background: #f8f9fa;
                border-radius: 4px;
            }
            .response-body pre { 
                background: #f8f9fa; padding: 10px; border-radius: 4px;
                overflow-x: auto; font-size: 0.8em;
            }
            code { 
                background: #f8f9fa; padding: 2px 4px; border-radius: 3px;
                font-family: 'Monaco', 'Consolas', monospace; font-size: 0.9em;
            }
            @media (max-width: 768px) {
                .container { padding: 10px; }
                .summary-cards { grid-template-columns: 1fr 1fr; }
                .request-info { flex-direction: column; align-items: flex-start; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔍 TestFlow Pro</h1>
                <div class="subtitle">Test Execution Report - ${new Date().toLocaleString()}</div>
            </div>
            
            <div class="summary-cards">
                <div class="card">
                    <h3>Total Suites</h3>
                    <div class="value">${totalSuites}</div>
                </div>
                <div class="card pass">
                    <h3>Passed</h3>
                    <div class="value">${totalPassed}</div>
                </div>
                <div class="card fail">
                    <h3>Failed</h3>
                    <div class="value">${totalFailed}</div>
                </div>
                <div class="card time">
                    <h3>Total Time</h3>
                    <div class="value">${(totalTime / 1000).toFixed(1)}s</div>
                </div>
            </div>
            
            ${apiSuites.length > 0 ? `
            <div class="section">
                <h2>🔗 API Test Suites</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Suite Name</th>
                            <th>Service</th>
                            <th>Type</th>
                            <th>Tests</th>
                            <th>Passed</th>
                            <th>Failed</th>
                            <th>Assertions</th>
                            <th>Duration</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateSuiteRows(apiSuites, 'API')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${uiSuites.length > 0 ? `
            <div class="section">
                <h2>🖱️ UI Test Suites</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Suite Name</th>
                            <th>Service</th>
                            <th>Type</th>
                            <th>Tests</th>
                            <th>Passed</th>
                            <th>Failed</th>
                            <th>Assertions</th>
                            <th>Duration</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateSuiteRows(uiSuites, 'UI')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            ${otherSuites.length > 0 ? `
            <div class="section">
                <h2>📋 Other Test Suites</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Suite Name</th>
                            <th>Service</th>
                            <th>Type</th>
                            <th>Tests</th>
                            <th>Passed</th>
                            <th>Failed</th>
                            <th>Assertions</th>
                            <th>Duration</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${generateSuiteRows(otherSuites, 'OTHER')}
                    </tbody>
                </table>
            </div>
            ` : ''}
            
            <div class="section">
                <h2>❌ Failed Test Details</h2>
                ${generateFailedDetails()}
            </div>
        </div>
    </body>
    </html>
    `;
}
