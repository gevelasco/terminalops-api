export const TRIP_INCIDENT_IMAGE_STORAGE_FOLDER = 'trip-incident-images';

export const TRIP_INCIDENT_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export type TripIncidentImageMimeType =
  (typeof TRIP_INCIDENT_IMAGE_MIME_TYPES)[number];
