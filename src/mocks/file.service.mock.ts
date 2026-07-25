export const FileServiceMock = {
  upload: jest.fn().mockResolvedValue({
    originalName: 'mocked-file.pdf',
    size: '12345',
    url: 'unit-documents/mocked-file.pdf',
    extension: 'pdf',
  }),
  presignedUrl: jest.fn().mockResolvedValue({ url: 'https://signed.example/file' }),
  remove: jest.fn().mockResolvedValue({}),
};
