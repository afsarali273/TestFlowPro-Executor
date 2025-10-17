import { TestSuite } from "../types";

/**
 * Check if a test suite matches given CLI filters.
 *
 * Supports filtering by:
 * - applicationName (partial match, case-insensitive)
 * - testType ("API" or "UI")
 * - tags (any key under suite.tags with optional NOT logic)
 *
 * 🔹 Tag Filtering Rules:
 * - `--suiteType="@smoke"` → Suite must have `suite.tags.some(t => t.suiteType === "@smoke")`
 * - `--suiteType="!@regression"` → Suite must NOT have `suiteType === "@regression"`
 * - `--suiteType="@smoke,!@regression"` → Suite must have `@smoke` AND not have `@regression`
 *
 * 🔹 Multiple Filters:
 * Filters can be combined. A suite must satisfy **all** filters to pass.
 *
 * @example
 * // Filter by application name
 * npx ts-node src/runner.ts --applicationName="Bookstore Application"
 *
 * // Filter by test type
 * npx ts-node src/runner.ts --testType="API"
 * npx ts-node src/runner.ts --testType="UI"
 *
 * // Filter by tags
 * npx ts-node src/runner.ts --serviceName="@BookService" --suiteType="@smoke"
 *
 * // Exclude by tag (NOT logic)
 * npx ts-node src/runner.ts --suiteType="!@regression"
 *
 * // Require smoke but exclude regression
 * npx ts-node src/runner.ts --suiteType="@smoke,!@regression"
 *
 * // Combine multiple filters
 * npx ts-node src/runner.ts --applicationName="Bookstore" --testType="API" --suiteType="@regression"
 *
 * @param suite - The test suite to check
 * @param filters - CLI filters as key/value pairs
 * @returns true if the suite matches all filters, false otherwise
 */
export function suiteMatchesFilters(suite: TestSuite, filters: Record<string, string>): boolean {
    for (const [key, rawValue] of Object.entries(filters)) {
        switch (key) {
            case "applicationName":
                if (!suite.applicationName?.toLowerCase().includes(rawValue.toLowerCase())) {
                    return false;
                }
                break;

            case "testType":
                if ((rawValue === "UI" && suite.type !== "UI") || (rawValue === "API" && suite.type !== "API")) {
                    return false;
                }
                break;

            default:
                // tag filters, possibly multiple values separated by comma
                const filterValues = rawValue.split(",").map(v => v.trim());

                for (const filter of filterValues) {
                    const isNegation = filter.startsWith("!");
                    const tagValue = isNegation ? filter.slice(1) : filter;

                    const hasTag = suite.tags?.some(tag => tag[key] === tagValue) ?? false;

                    if (!isNegation && !hasTag) {
                        return false; // required tag missing
                    }
                    if (isNegation && hasTag) {
                        return false; // forbidden tag present
                    }
                }
        }
    }
    return true;
}
