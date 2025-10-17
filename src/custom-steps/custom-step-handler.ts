import { Page } from 'playwright';
import { CustomStepFunction } from '../types';
import { setVariable, injectVariables } from '../utils/variableStore';
import { FlipkartHomePage, FlipkartProductPage } from '../page-objects/FlipkartHomePage';

export class CustomStepHandler {
    private customFunctions = new Map<string, Function>();
    private pageObjects = new Map<string, any>();

    constructor() {
        this.registerPageObjects();
    }

    registerFunction(name: string, func: Function): void {
        this.customFunctions.set(name, func);
    }

    registerPageObject(name: string, pageObjectClass: any): void {
        this.pageObjects.set(name, pageObjectClass);
    }

    async executeCustomStep(page: Page, customFunction: CustomStepFunction): Promise<any> {
        const { function: functionName, args = [], mapTo } = customFunction;

        if (functionName.includes('.')) {
            return this.executePageObjectMethod(page, functionName, args, mapTo);
        }
        return this.executeStandaloneFunction(page, functionName, args, mapTo);
    }

    private async executePageObjectMethod(
        page: Page,
        functionName: string,
        args: any[],
        mapTo?: { [key: string]: string }
    ): Promise<any> {
        const [pageObjectName, methodName] = functionName.split('.');
        
        console.log(`📝 Initializing ${pageObjectName}`);
        
        const PageObjectClass = this.pageObjects.get(pageObjectName);
        if (!PageObjectClass) {
            throw new Error(`Page object '${pageObjectName}' not found`);
        }

        const pageObject = new PageObjectClass(page);
        
        if (typeof pageObject[methodName] !== 'function') {
            throw new Error(`Method '${methodName}' not found in ${pageObjectName}`);
        }

        const processedArgs = this.processArguments(args);
        if (processedArgs.length > 0) {
            console.log(`📝 Args: [${processedArgs.join(', ')}]`);
        }

        console.log(`🚀 ${pageObjectName}.${methodName}()`);
        const result = await pageObject[methodName](...processedArgs);
        console.log(`✅ ${pageObjectName}.${methodName}() completed`);

        if (mapTo && result) {
            this.storeResults(result, mapTo);
        }

        return result;
    }

    private async executeStandaloneFunction(
        page: Page,
        functionName: string,
        args: any[],
        mapTo?: { [key: string]: string }
    ): Promise<any> {
        const func = this.customFunctions.get(functionName);
        if (!func) {
            throw new Error(`Function '${functionName}' not found`);
        }

        const processedArgs = this.processArguments(args);
        console.log(`🚀 ${functionName}()`);
        
        const result = await func(page, ...processedArgs);
        console.log(`✅ ${functionName}() completed`);

        if (mapTo && result) {
            this.storeResults(result, mapTo);
        }

        return result;
    }

    private processArguments(args: any[]): any[] {
        return args.map(arg => typeof arg === 'string' ? injectVariables(arg) : arg);
    }

    private storeResults(result: any, mapTo: { [key: string]: string }): void {
        if (typeof result === 'object' && result !== null) {
            Object.entries(mapTo).forEach(([varName, path]) => {
                const value = this.getNestedProperty(result, path);
                if (value !== undefined) {
                    setVariable(varName, value);
                    console.log(`💾 ${varName} = ${value}`);
                }
            });
        } else {
            const [varName] = Object.keys(mapTo);
            if (varName) {
                setVariable(varName, result);
                console.log(`💾 ${varName} = ${result}`);
            }
        }
    }

    private getNestedProperty(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private registerPageObjects(): void {
        this.registerPageObject('FlipkartHomePage', FlipkartHomePage);
        this.registerPageObject('FlipkartProductPage', FlipkartProductPage);
    }
}

export const customStepHandler = new CustomStepHandler();