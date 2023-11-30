// ALL FUNCTIONS IN THIS FOLDER ARE EXPORTED TO app.mjs
// TO RUN THESE FUNCTIONS, RUN app.mjs
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import { logger, time } from './logger';

dotenv.config();

const user = String(process.env.RDS_USER)
const host = String(process.env.RDS_HOST)
const password = String(process.env.RDS_PASSWORD)
const database = String(process.env.RDS_DB_NAME)

const dbConfig = {
  user: user,
  host: host,
  database: database,
  password: password,
  port: 5432, // Default PostgreSQL port
  ssl: {
    // Set the SSL option
    rejectUnauthorized: false, // Reject self-signed certificates (recommended for production)
  },
};

const TABLE_NAME = 'package_data';

async function get_rds_connection() {
  const client = new Client(dbConfig);

  try {
    await client.connect();
    logger.debug('Successfully connected to RDS')
  } catch (error) {
    logger.error('Error connecting to the database:', error);
  }

  return client
}

async function setup_rds_tables() {
    const client = await get_rds_connection();

    try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS package_data (
            package_id SERIAL PRIMARY KEY,
            package_name VARCHAR(50) UNIQUE NOT NULL,
            rating JSON NOT NULL,
            num_downloads INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);
        logger.debug(`Successfully created tables`);
      } catch (error) {
        logger.error('Error creating table:', error);
      } finally {
        await client.end();
      }
}

async function drop_package_data_table() {
    const client = await get_rds_connection();

    try {
        await client.query(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
      } catch (error) {
        logger.error('Error creating table:', error);
      } finally {
        await client.end();
      }
}

async function clear_package_data() {
    const client = await get_rds_connection();

    try {
        await client.query('DELETE FROM package_data');
      } catch (error) {
        console.error('Error clearing package data:', error);
      } finally {
        await client.end();
      }
}

async function display_package_data() {
    const client = await get_rds_connection();

    try {
        const result = await client.query('SELECT * FROM package_data');
    
        console.log('Package data:');
        console.log(result.rows)
      } catch (error) {
        console.error('Error displaying package data:', error);
      } finally {
        await client.end();
      }
}

export {
    get_rds_connection,
    setup_rds_tables,
    drop_package_data_table,
    clear_package_data,
    display_package_data,
    TABLE_NAME,
}
