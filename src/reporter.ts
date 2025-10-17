import * as fs from 'fs';
import * as path from 'path';

export interface StepResult {
    stepId: string;
    keyword: string;
    locator?: any;
    value?: string;
    status: 'PASS' | 'FAIL' | 'SKIPPED';
    error?: string;
    screenshotPath?: string;
    executionTimeMs: number;
    timestamp: string;
}

export interface ReportEntry {
    testCase: string;
    dataSet: string;
    status: 'PASS' | 'FAIL';
    error?: string;
    assertionsPassed?: number;
    assertionsFailed?: number;
    responseTimeMs?: number;
    responseBody?: any;
    stepResults?: StepResult[];
    apiDetails?: any;
}

export interface Tag {
    [key: string]: string;
}

export class Reporter {
    private report: ReportEntry[] = [];
    private startTime: number = 0;
    private suiteName: string = '';
    private tagsMap: { [key: string]: string } = {};
    private runId: string = '';

    start(suiteName: string, tags?: Tag[], runId?: string) {
        this.suiteName = suiteName;
        this.report = [];
        this.startTime = Date.now();
        this.tagsMap = {};
        this.runId = runId || `run-${Date.now()}`;
        if (tags) {
            for (const tag of tags) {
                Object.entries(tag).forEach(([k, v]) => {
                    this.tagsMap[k] = v;
                });
            }
        }
        console.log(`Started reporting for suite: ${suiteName} (Run: ${this.runId})`);
    }

    add(entry: ReportEntry) {
        this.report.push(entry);
    }

    writeReportToFile() {
        const totalTestCases = new Set(this.report.map((r) => r.testCase)).size;
        const totalDataSets = this.report.length;
        const passed = this.report.filter((r) => r.status === 'PASS').length;
        const failed = this.report.filter((r) => r.status === 'FAIL').length;
        
        // Calculate step-level statistics
        const allSteps = this.report.flatMap(r => r.stepResults || []);
        const stepsTotal = allSteps.length;
        const stepsPassed = allSteps.filter(s => s.status === 'PASS').length;
        const stepsFailed = allSteps.filter(s => s.status === 'FAIL').length;
        const stepsSkipped = allSteps.filter(s => s.status === 'SKIPPED').length;
        const totalAssertionsPassed = this.report.reduce(
            (sum, r) => sum + (r.assertionsPassed || 0),
            0
        );
        const totalAssertionsFailed = this.report.reduce(
            (sum, r) => sum + (r.assertionsFailed || 0),
            0
        );
        const executionTimeMs = Date.now() - this.startTime;

        const output = {
            summary: {
                suiteName: this.suiteName,
                runId: this.runId,
                tags: this.tagsMap,
                totalTestCases,
                totalDataSets,
                passed,
                failed,
                totalAssertionsPassed,
                totalAssertionsFailed,
                executionTimeMs,
                stepStatistics: {
                    total: stepsTotal,
                    passed: stepsPassed,
                    failed: stepsFailed,
                    skipped: stepsSkipped
                }
            },
            results: this.report,
        };

        const fileName = `result-${this.suiteName.replace(/\s+/g, '_')}-${new Date()
            .toISOString()
            .replace(/[:.]/g, '-')}.json`;
        const fullPath = path.normalize(path.join(__dirname, '../reports', fileName));
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, JSON.stringify(output, null, 2), 'utf-8');
        console.log(`\n📄 Report written to: ${fullPath}`);
    }
    
    getSummary() {
        const totalTestCases = new Set(this.report.map((r) => r.testCase)).size;
        const totalDataSets = this.report.length;
        const passed = this.report.filter((r) => r.status === 'PASS').length;
        const failed = this.report.filter((r) => r.status === 'FAIL').length;
        const executionTimeMs = Date.now() - this.startTime;
        
        return {
            totalTestCases,
            totalDataSets,
            passed,
            failed,
            executionTimeMs
        };
    }
}
