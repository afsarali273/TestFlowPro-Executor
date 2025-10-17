// import dotenv from 'dotenv';
// dotenv.config();

type DbType = 'mysql' | 'odbc' | 'db2';

export interface DbConnectionConfig {
    type: DbType;
    mysqlConfig?: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    odbcConnectionString?: string;
}

// Lazy-load and cache configs
const cachedConfigs: Record<string, DbConnectionConfig> = {};

export function getDbConfig(dbName: string): DbConnectionConfig {
    if (cachedConfigs[dbName]) return cachedConfigs[dbName];

    const prefix = `DB_${dbName.toUpperCase()}`;
    const type = process.env[`${prefix}_TYPE`] as DbType;

    if (!type) throw new Error(`Database type not specified for: ${dbName}`);

    if (type === 'mysql') {
        const config: DbConnectionConfig = {
            type,
            mysqlConfig: {
                host: process.env[`${prefix}_HOST`]!,
                port: parseInt(process.env[`${prefix}_PORT`] || '3306'),
                user: process.env[`${prefix}_USER`]!,
                password: process.env[`${prefix}_PASSWORD`]!,
                database: process.env[`${prefix}_NAME`]!,
            }
        };
        cachedConfigs[dbName] = config;
        return config;
    }

    if (type === 'odbc' || type === 'db2') {
        const config: DbConnectionConfig = {
            type,
            odbcConnectionString: process.env[`${prefix}_CONNSTRING`]!
        };
        cachedConfigs[dbName] = config;
        return config;
    }

    throw new Error(`Unsupported DB type for: ${dbName}`);
}
