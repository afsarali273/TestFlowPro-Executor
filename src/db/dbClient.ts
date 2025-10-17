import mysql from 'mysql2/promise';
import odbc from 'odbc';
import { getDbConfig } from './config';

export async function runQuery(query: string, db: string): Promise<any[]> {
    const config = getDbConfig(db);

    if (config.type === 'mysql' && config.mysqlConfig) {
        const connection = await mysql.createConnection(config.mysqlConfig);
        const [rows] = await connection.execute(query);
        await connection.end();
        return rows as any[];
    }

    if ((config.type === 'odbc' || config.type === 'db2') && config.odbcConnectionString) {
        const connection = await odbc.connect(config.odbcConnectionString);
        const result = await connection.query(query);
        await connection.close();
        return result;
    }

    throw new Error(`Invalid DB config for: ${db}`);
}
