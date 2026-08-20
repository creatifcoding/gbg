export function pad2(value: number): string
export function formatExifLocal(date: Date): string
export function formatExifUtc(date: Date): string

export type CaptureCoords = {
  latitude: number
  longitude: number
}

export type CaptureTags = {
  DateTimeOriginal: string
  GPSLatitude?: string
  GPSLatitudeRef?: 'N' | 'S'
  GPSLongitude?: string
  GPSLongitudeRef?: 'E' | 'W'
  GPSDateTime?: string
}

export function tagsFromCapture(input: {
  capturedAt: Date
  coords: CaptureCoords | null
}): CaptureTags

export function captureFilename(capturedAt: Date): string
