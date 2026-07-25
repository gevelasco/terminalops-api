import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { sanitize } from 'sanitize-filename-ts';
import * as AWS from 'aws-sdk';
import EnvConfig from 'src/types/env-config.type';

type FileMetadata = {
  path: string;
  size: string;
  url: string;
  originalName: string;
  extension: string;
  name: string;
};

export type UploadedFileResult = {
  url: string;
  size: string;
  originalName: string;
  extension: string;
};

type StorageConfig = {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKeyId: string;
  secretAccessKey: string;
};

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private s3: AWS.S3 | undefined;
  private resolved: StorageConfig | undefined;

  constructor(private readonly configService: ConfigService<EnvConfig>) {}

  private getConfig(): StorageConfig {
    if (this.resolved) {
      return this.resolved;
    }

    const bucket = this.firstConfig(
      'RW_S3_BUCKET',
      'AWS_S3_BUCKET',
      'BUCKET',
    );
    const accessKeyId = this.firstConfig(
      'RW_ACCESS_KEY_ID',
      'AWS_ACCESS_KEY_ID',
      'ACCESS_KEY_ID',
    );
    const secretAccessKey = this.firstConfig(
      'RW_SECRET_ACCESS_KEY',
      'AWS_SECRET_ACCESS_KEY',
      'SECRET_ACCESS_KEY',
    );
    const region =
      this.firstConfig('RW_REGION', 'AWS_REGION', 'AWS_DEFAULT_REGION', 'REGION') ||
      'auto';
    const endpoint = this.firstConfig(
      'RW_URL',
      'AWS_S3_ENDPOINT',
      'AWS_ENDPOINT_URL',
      'ENDPOINT',
    );

    if (!bucket || !accessKeyId || !secretAccessKey) {
      this.logger.error(
        'Object storage env missing. Set RW_S3_BUCKET, RW_ACCESS_KEY_ID, RW_SECRET_ACCESS_KEY, RW_URL, RW_REGION (or Railway bucket vars).',
      );
      throw new HttpException(
        'Object storage is not configured',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.resolved = {
      bucket,
      region,
      endpoint: endpoint || undefined,
      accessKeyId,
      secretAccessKey,
    };
    return this.resolved;
  }

  private firstConfig(...keys: string[]): string {
    for (const key of keys) {
      const value = this.configService.get(key as keyof EnvConfig, {
        infer: true,
      });
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
      // ConfigModule also exposes process.env for undeclared keys.
      const fromEnv = process.env[key];
      if (typeof fromEnv === 'string' && fromEnv.trim()) {
        return fromEnv.trim();
      }
    }
    return '';
  }

  private getS3Instance(): AWS.S3 {
    if (this.s3) {
      return this.s3;
    }

    const { endpoint, region, accessKeyId, secretAccessKey } = this.getConfig();

    // Railway/Tigris (y LocalStack) son S3-compatible: endpoint + path-style.
    this.s3 = new AWS.S3(
      endpoint
        ? {
            endpoint,
            region,
            accessKeyId,
            secretAccessKey,
            s3ForcePathStyle: true,
            signatureVersion: 'v4',
          }
        : {
            region,
            accessKeyId,
            secretAccessKey,
          },
    );

    return this.s3;
  }

  async presignedUrl(file: string, expiration?: number) {
    const { bucket } = this.getConfig();
    const params = {
      Bucket: bucket,
      Key: file,
      Expires: expiration ?? 60 * 5,
    };

    try {
      const url = await this.getS3Instance().getSignedUrlPromise(
        'getObject',
        params,
      );
      return { url };
    } catch (e) {
      this.logger.error('Error getting s3 url', e instanceof Error ? e.stack : e);
      throw new HttpException('File not found', HttpStatus.NOT_FOUND);
    }
  }

  async upload(
    folder: string,
    file: Express.Multer.File,
  ): Promise<UploadedFileResult> {
    const metadata = this.generateMetadata(file, folder);
    await this.s3Upload(file.buffer, metadata.url, file.mimetype);
    return {
      url: metadata.url,
      size: metadata.size,
      originalName: metadata.originalName,
      extension: metadata.extension,
    };
  }

  remove(url: string) {
    const { bucket } = this.getConfig();
    return this.getS3Instance()
      .deleteObject({
        Bucket: bucket,
        Key: url,
      })
      .promise();
  }

  private generateMetadata(
    file: Express.Multer.File,
    folder: string,
  ): FileMetadata {
    const originalName = sanitize(decodeURIComponent(file?.originalname ?? ''), {
      replacement: '-',
    });
    const extension = originalName?.split('.').pop() ?? '';
    const name = `${String(randomUUID())}.${extension}`;
    return {
      path: folder,
      size: String(file.size),
      url: `${folder}/${name}`,
      originalName,
      extension,
      name,
    };
  }

  private async s3Upload(file: Buffer, name: string, mimetype: string) {
    const { bucket } = this.getConfig();
    const params = {
      Bucket: bucket,
      Key: name,
      Body: file,
      ContentType: mimetype,
      ContentDisposition: 'inline',
    };

    try {
      return await this.getS3Instance().upload(params).promise();
    } catch (e) {
      this.logger.error(
        'Error uploading s3 file',
        e instanceof Error ? e.stack : e,
      );
      throw new HttpException(
        'Error uploading file',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
