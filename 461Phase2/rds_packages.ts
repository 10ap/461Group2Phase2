// ALL FUNCTIONS IN THIS FOLDER ARE EXPORTED TO app.mjs
// TO RUN THESE FUNCTIONS, RUN app.mjs
import { QueryResult } from 'pg';
import { get_rds_connection, TABLE_NAME } from './rds_config';
import { logger, time } from './logger';

interface PackageData {
    package_id: number,
    package_name: string,
    rating: {
      busFactor: number;
      rampup: number;
      license: number;
      correctness: number;
      maintainer: number;
      pullRequest: number;
      pinning: number;
      score: number;
    },
    num_downloads: number,
    created_at: Date,
}

// Adds data to the amazon RDS instance. That data is assigned a unique ID that is returned.
// This ID is used to locate the package contents in the S3 bucket.
async function add_rds_package_data(name: string, rating: object) : Promise<number | null> {
  const client = await get_rds_connection();

  try {
      const query = `
        INSERT INTO package_data(package_name, rating, num_downloads) VALUES($1, $2, $3)
        RETURNING package_id;
      `;
      const values = [name, rating, 0]
      const result: QueryResult<PackageData> = await client.query(query, values);

      // Making sure something is returned at all
      if (result.rowCount == 0) {
        return null;
      }

      return result.rows[0].package_id;
    } catch (error) {
      logger.error('Error entering data:', error);
      return null;
    } finally {
      await client.end();
    }
}

async function get_package_data(package_id: number) : Promise<PackageData | null> {
  const client = await get_rds_connection();

  try {
      const query = `
        SELECT * FROM ${TABLE_NAME} WHERE package_id = $1
      `;
      const values = [package_id]
      const data: QueryResult<PackageData> = await client.query(query, values);

      // Making sure something is returned at all
      if (data.rowCount == 0) {
        return null;
      }

      return data.rows[0];
    } catch (error) {
      logger.error('Error grabbing data:', error);
      return null;
    } finally {
      await client.end();
    }
}

// Finds all data for packages whos names match a given regex
async function match_rds_rows(regex: string) : Promise<PackageData[]> {
    const client = await get_rds_connection();

    try {
        const query = `
            SELECT * FROM ${TABLE_NAME}
            WHERE package_name ~ $1;
        `;
        const values = [regex]

        const result: QueryResult<PackageData> = await client.query(query, values);

        logger.debug('Query result:', result.rows);
    
        return result.rows;

      } catch (error) {
        logger.error('Error searching data:', error);
        return [];
      } finally {
        await client.end();
      }
}



export {
    add_rds_package_data,
    get_package_data,
    match_rds_rows,
    PackageData,
}
