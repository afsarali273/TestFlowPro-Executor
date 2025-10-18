import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { TestSuite } from "../types";
import { Reporter } from "../reporter";
import { TestRunner } from "./TestRunner";
import { ExecutionTarget } from "./ExecutionTarget";
import { suiteMatchesFilters } from "./SuiteFilter";

const maxParallel = Number(process.env.MAX_PARALLEL_SUITES) || 2;

// Default suites directory (can be overridden by passing parameter)
const defaultSuitesDir = path.join(__dirname, "../../testSuites");

export async function runTarget(filePath: string, target: ExecutionTarget, filters: Record<string, string>, runId: string) {
    console.log(`📄 Loading suite from: ${filePath}`);
    const suite: TestSuite = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    console.log(`📋 Suite loaded: ${suite.suiteName} (${suite.id})`);
    console.log(`🎯 Target type: ${target.type}`);
    console.log(`🔍 Looking for testCase: ${target.testCaseName} (ID: ${target.testCaseId})`);

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

export async function runAllSuitesParallel(filters: Record<string, string>, suitesDir: string = defaultSuitesDir) {
    const files = getAllSuiteFiles(suitesDir);
    const limit = pLimit(maxParallel);
    const runId = generateRunName();

    console.log(`\n🚀 Starting ${runId}`);
    if (Object.keys(filters).length) console.log(`📋 Filters: ${JSON.stringify(filters)}`);

    await Promise.all(files.map(file => limit(() => runSuiteFromFile(file, filters, runId))));
    console.log(`\n✅ ${runId} completed with max parallelism = ${maxParallel}`);
}

function getAllSuiteFiles(dir: string): string[] {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith(".json")) {
            files.push(path.normalize(fullPath));
        } else if (entry.isDirectory()) {
            files.push(...getAllSuiteFiles(fullPath));
        }
    }
    
    return files;
}

export function generateRunName(): string {
    return `Run #${Math.floor(Math.random() * 999) + 1} - ${new Date().toLocaleString()}`;
}

export async function findSuiteFile(suiteId: string, suiteName: string, suitesDir: string = defaultSuitesDir): Promise<string | null> {
    const result = findSuiteFileRecursive(suiteId, suiteName, suitesDir);
    
    if (!result) {
        console.error(`❌ Suite not found: ${suiteName}`);
        console.error(`   Searched for ID: ${suiteId}`);
        console.error(`   Searched in: ${suitesDir}`);
        
        // Show available suites
        const availableSuites = getAllAvailableSuites(suitesDir);
        if (availableSuites.length > 0) {
            console.error(`   Available suites:`);
            availableSuites.forEach(suite => {
                console.error(`     - ID: ${suite.id}, Name: "${suite.name}" (${suite.file})`);
            });
        }
    }
    
    return result;
}

function getAllAvailableSuites(dir: string): Array<{id: string, name: string, file: string}> {
    const suites: Array<{id: string, name: string, file: string}> = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const suite: TestSuite = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
                suites.push({id: suite.id, name: suite.suiteName, file: entry.name});
            } catch (err) {
                // Skip invalid JSON files
            }
        } else if (entry.isDirectory()) {
            suites.push(...getAllAvailableSuites(fullPath));
        }
    }
    
    return suites;
}

function findSuiteFileRecursive(suiteId: string, suiteName: string, dir: string): string | null {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    // First, check JSON files in current directory
    for (const entry of entries) {
        if (entry.isFile() && entry.name.endsWith(".json")) {
            try {
                const filePath = path.join(dir, entry.name);
                const suite: TestSuite = JSON.parse(fs.readFileSync(filePath, "utf-8"));
                if (suite.id === suiteId || suite.suiteName === suiteName) {
                    console.log(`✅ Found matching suite: ${entry.name}`);
                    return path.normalize(filePath);
                }
            } catch (error) {
                // Skip invalid JSON files
            }
        }
    }
    
    // Then, recursively search subdirectories
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const result = findSuiteFileRecursive(suiteId, suiteName, path.join(dir, entry.name));
            if (result) return result;
        }
    }
    
    return null;
}
