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

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);
  private s3: AWS.S3;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService<EnvConfig>) {
    this.bucket = this.configService.get('RW_S3_BUCKET', { infer: true }) ?? '';
    if (!this.bucket) {
      throw new HttpException(
        'Missing bucket configuration (RW_S3_BUCKET)',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private getS3Instance(): AWS.S3 {
    if (this.s3) {
      return this.s3;
    }

    const accessKeyId = this.configService.get('RW_ACCESS_KEY_ID', {
      infer: true,
    });
    const secretAccessKey = this.configService.get('RW_SECRET_ACCESS_KEY', {
      infer: true,
    });
    const region = this.configService.get('RW_REGION', { infer: true });
    const endpoint = this.configService.get('RW_URL', { infer: true });

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
    const params = {
      Bucket: this.bucket,
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
    return this.getS3Instance()
      .deleteObject({
        Bucket: this.bucket,
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
    const params = {
      Bucket: this.bucket,
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
