export class Logger {
    private static colors = {
        reset: '\x1b[0m', bright: '\x1b[1m', red: '\x1b[31m', green: '\x1b[32m',
        yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
    };

    static box(title: string, content: string, color: string = Logger.colors.cyan) {
        console.log(`${color}${Logger.colors.bright}${title}${Logger.colors.reset}`);
        content.split('\n').forEach(line => console.log(`  ${line}`));
    }

    static section(emoji: string, title: string, color: string = Logger.colors.cyan) {
        console.log(`\n${color}${Logger.colors.bright}${emoji} ${title}${Logger.colors.reset}`);
    }

    static success(msg: string) { console.log(`${Logger.colors.green}✅ ${msg}${Logger.colors.reset}`); }
    static error(msg: string) { console.log(`${Logger.colors.red}❌ ${msg}${Logger.colors.reset}`); }
    static warning(msg: string) { console.log(`${Logger.colors.yellow}⚠️  ${msg}${Logger.colors.reset}`); }
    static info(msg: string) { console.log(`${Logger.colors.blue}ℹ️  ${msg}${Logger.colors.reset}`); }
    static request(method: string, url: string) {
        console.log(`${Logger.colors.magenta}🚀 ${Logger.colors.bright}${method}${Logger.colors.reset} ${Logger.colors.cyan}${url}${Logger.colors.reset}`);
    }
}
