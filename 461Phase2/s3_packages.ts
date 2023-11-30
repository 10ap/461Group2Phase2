import * as AWS from 'aws-sdk';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { logger, time } from './logger';

dotenv.config();

const access_id = String(process.env.S3_ACCESS_ID);
const access_key = String(process.env.S3_ACCESS_KEY);
const region = String(process.env.S3_REGION);

// Set your AWS credentials and region
AWS.config.update({
  accessKeyId: access_id,
  secretAccessKey: access_key,
  region: region,
});

// Create an S3 instance
const s3 = new AWS.S3();
const BUCKET_NAME = "461s3bucketv2";

async function upload_package(package_id: number, file: any) : Promise<string | null> {
    const file_content = file.buffer;
    const unique_filename = `package_ID_${package_id}`;

    const params: AWS.S3.PutObjectRequest = {
        Bucket: BUCKET_NAME,
        Key: unique_filename,
        Body: file_content,
      };
    
    try {
        await s3.upload(params).promise();
        const file_url = `https://${BUCKET_NAME}.s3.${AWS.config.region}.amazonaws.com/${unique_filename}`;
        logger.debug(`File uploaded successfully to S3. URL: ${file_url}`);
        
        return file_url;
    } catch (error) {
        logger.error('Error uploading file to S3:', error);
        return null;
    }
}

async function download_package(package_id: number) : Promise<Buffer | null> {
    const params = {
        Bucket: BUCKET_NAME,
        Key: `package_ID_${package_id}`
    }

    try {
        const file = await s3.getObject(params).promise();

        logger.debug(`File downloaded successfully.`);
        return file.Body as Buffer;
    } catch (error) {
        logger.error('Error downloading file from S3:', error);
        return null;
    }
}

async function clear_s3_bucket() {
    const params: AWS.S3.DeleteObjectsRequest = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: [] }, // Initialize the Objects array
      };
    
    try {
    const s3Objects = await s3.listObjects(params).promise();

    if (s3Objects.Contents && s3Objects.Contents.length > 0) {
        params.Delete.Objects = s3Objects.Contents.map(obj => ({ Key: obj.Key })) as AWS.S3.ObjectIdentifierList;
        await s3.deleteObjects(params).promise();
        logger.debug('All S3 objects deleted successfully.');
    } else {
        logger.debug('No S3 objects to delete!');
    }
    } catch (error) {
        logger.error('Error deleting S3 objects:', error)
    }
}

export {
    upload_package,
    download_package,
    clear_s3_bucket,
}
