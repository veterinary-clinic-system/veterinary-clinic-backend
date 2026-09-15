import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import * as entities from './entities';

config();

/**
 * Used only by the `typeorm`/`migration:*` CLI scripts in package.json (they run
 * outside Nest's DI container, so config comes straight from process.env via dotenv
 * rather than ConfigService). The app itself boots TypeORM through
 * `database.module.ts`, which mirrors these same options.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'vetclinic',
  password: process.env.DB_PASSWORD ?? 'vetclinic',
  database: process.env.DB_DATABASE ?? 'veterinary_clinic',
  entities: Object.values(entities),
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.DB_LOGGING === 'true',
};

export default new DataSource(dataSourceOptions);
