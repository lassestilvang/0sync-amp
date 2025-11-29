export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
}

export const getDatabaseConfig = (): DatabaseConfig => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL not set');
  }

  const dbUrl = new URL(url);
  return {
    host: dbUrl.hostname || 'localhost',
    port: parseInt(dbUrl.port || '5432', 10),
    username: dbUrl.username || 'sync_user',
    password: dbUrl.password || 'sync_password',
    database: dbUrl.pathname?.slice(1) || 'sync_db',
  };
};
