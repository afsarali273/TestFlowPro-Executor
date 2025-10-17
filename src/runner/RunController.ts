import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { TestSuite } from "../types";
import { Reporter } from "../reporter";
import { TestRunner } from "./TestRunner";
import { ExecutionTarget } from "./ExecutionTarget";
import { suiteMatchesFilters } from "./SuiteFilter";

const suitesDir = path.join(__dirname, "../../testSuites");
const maxParallel = Number(process.env.MAX_PARALLEL_SUITES) || 2;

export async function runTarget(filePath: string, target: ExecutionTarget, filters: Record<string, string>, runId: string) {

    const suite: TestSuite = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    // 2. Check if the suite matches the requested target (suiteId or suiteName)
    if (suite.id !== target.suiteId && suite.suiteName !== target.suiteName) {
        console.log(`⏭️ Skipping suite. Target mismatch: expected "${target.suiteId}:${target.suiteName}", found "${suite.id}:${suite.suiteName}"`);
        return;
    }

    // 3. Apply CLI filters (applicationName, testType, tags, etc.)
    if (Object.keys(filters).length > 0 && !suiteMatchesFilters(suite, filters)) {
        const appliedFilters = Object.entries(filters)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ");
        //console.log(`⏭️ Skipping suite "${suite.suiteName}" (${suite.id}) — did not match filters: ${appliedFilters}`);
        return;
    }


    const reporter = new Reporter();
    const targetDesc = target.type === 'suite' ? suite.suiteName : 
                      target.type === 'testcase' ? `${target.testCaseName} (${suite.suiteName})` :
                      `${target.testDataName} (${target.testCaseName} > ${suite.suiteName})`;
    
    reporter.start(targetDesc, suite.tags, runId);

    const runner = new TestRunner(reporter);

    try {
        if (target.type === "suite") await runner.executeSuite(suite);
        else if (target.type === "testcase") await runner.executeTestCase(suite, target);
        else if (target.type === "testdata") await runner.executeTestData(suite, target);
    } catch (err) {
        console.error("❌ Execution failed:", err);
    } finally {
        reporter.writeReportToFile();
        
        // Print summary for API parsing (same format as original)
        const summary = reporter.getSummary();
        console.log(`\n📊 Test Results Summary:`);
        console.log(`Total: ${summary.totalDataSets}`);
        console.log(`${summary.passed} passed`);
        console.log(`${summary.failed} failed`);
        console.log(`Execution time: ${summary.executionTimeMs}ms`);
    }
}

export async function runSuiteFromFile(filePath: string, filters: Record<string, string>, runId: string) {
    const suite: TestSuite = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const target: ExecutionTarget = { type: "suite", suiteId: suite.id, suiteName: suite.suiteName };
    await runTarget(filePath, target, filters, runId);
}

export async function runAllSuitesParallel(filters: Record<string, string>) {
    const files = fs.readdirSync(suitesDir).filter(f => f.endsWith(".json"));
    const limit = pLimit(maxParallel);
    const runId = generateRunName();

    console.log(`\n🚀 Starting ${runId}`);
    if (Object.keys(filters).length) console.log(`📋 Filters: ${JSON.stringify(filters)}`);

    await Promise.all(files.map(file => limit(() => runSuiteFromFile(path.normalize(path.join(suitesDir, file)), filters, runId))));
    console.log(`\n✅ ${runId} completed with max parallelism = ${maxParallel}`);
}

export function generateRunName(): string {
    return `Run #${Math.floor(Math.random() * 999) + 1} - ${new Date().toLocaleString()}`;
}

export async function findSuiteFile(suiteId: string, suiteName: string): Promise<string | null> {
    const files = fs.readdirSync(suitesDir).filter(f => f.endsWith(".json"));
    for (const file of files) {
        const suite: TestSuite = JSON.parse(fs.readFileSync(path.normalize(path.join(suitesDir, file)), "utf-8"));
        if (suite.id === suiteId || suite.suiteName === suiteName) return path.normalize(path.join(suitesDir, file));
    }
    return null;
}
