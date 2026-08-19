import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

/** Max document / incident image size accepted by multipart upload endpoints. */
export const UPLOAD_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MiB

/** Shared Multer options for `FileInterceptor('file', …)`. */
export const uploadFileMulterOptions: MulterOptions = {
  limits: {
    fileSize: UPLOAD_FILE_MAX_BYTES,
    files: 1,
  },
};
