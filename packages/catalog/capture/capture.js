import { writeMetadata } from './vendor/exiftool.js'
import {
  GEO_SHOT_OPTIONS,
  captureFilename,
  coordsFromGeolocation,
  tagsFromCapture,
} from './tags.js'

const wasmUrl = new URL('./vendor/zeroperl.wasm', import.meta.url)

const preview = document.querySelector('#preview')
const still = document.querySelector('#still')
const armBtn = document.querySelector('#arm')
const shootBtn = document.querySelector('#shoot')
const downloadBtn = document.querySelector('#download')
const errorEl = document.querySelector('#error')
const noteEl = document.querySelector('#note')
const cameraChip = document.querySelector('#camera-chip')
const geoChip = document.querySelector('#geo-chip')

let stream = null
let taggedBlob = null
let downloadName = 'specimen.jpg'

function setChip(el, state, label) {
  el.dataset.state = state
  el.textContent = label
}

function showError(message) {
  errorEl.hidden = !message
  errorEl.textContent = message || ''
}

function showNote(message) {
  noteEl.hidden = !message
  noteEl.textContent = message || ''
}

function localFetch(input, init) {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? String(input)
        : input instanceof Request
          ? input.url
          : ''
  if (
    raw === './zeroperl.wasm' ||
    raw.endsWith('zeroperl.wasm') ||
    raw.includes('zeroperl.wasm')
  ) {
    return fetch(wasmUrl, init)
  }
  return Promise.reject(new Error(`Capture page blocks network: ${raw || 'unknown url'}`))
}

function requestCoords() {
  return new Promise((resolve) => {
    setChip(geoChip, 'idle', 'locating')
    if (!navigator.geolocation) {
      setChip(geoChip, 'unknown', 'location unavailable')
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = coordsFromGeolocation(pos.coords)
        if (!next) {
          setChip(geoChip, 'unknown', 'location unknown')
          resolve(null)
          return
        }
        setChip(geoChip, 'fix', 'location fix')
        resolve(next)
      },
      () => {
        setChip(geoChip, 'denied', 'location denied')
        resolve(null)
      },
      GEO_SHOT_OPTIONS,
    )
  })
}

async function armCamera() {
  showError('')
  taggedBlob = null
  downloadBtn.disabled = true
  still.hidden = true
  preview.hidden = false
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    })
    preview.srcObject = stream
    await preview.play()
    setChip(cameraChip, 'live', 'camera live')
    shootBtn.disabled = false
    showNote(
      'Location is taken from the browser Geolocation API when you shoot, with enableHighAccuracy. Not IP, not Cloudflare, not the pixels.',
    )
  } catch (error) {
    setChip(cameraChip, 'blocked', 'camera blocked')
    shootBtn.disabled = true
    showError(error instanceof Error ? error.message : 'Camera request failed.')
  }
}

function canvasJpeg(video) {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  if (canvas.width < 2 || canvas.height < 2) {
    return Promise.reject(new Error('Camera frame is empty.'))
  }
  const ctx = canvas.getContext('2d')
  if (!ctx) return Promise.reject(new Error('Canvas is unavailable.'))
  ctx.drawImage(video, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Canvas produced no JPEG.'))
        else resolve(blob)
      },
      'image/jpeg',
      0.92,
    )
  })
}

async function shoot() {
  showError('')
  shootBtn.disabled = true
  try {
    const capturedAt = new Date()
    const shotCoords = await requestCoords()
    const jpeg = await canvasJpeg(preview)
    const filename = captureFilename(capturedAt)
    const file = new File([jpeg], filename, { type: 'image/jpeg' })
    const tags = tagsFromCapture({ capturedAt, coords: shotCoords })
    const result = await writeMetadata(file, tags, { fetch: localFetch, args: ['-m'] })
    if (!result.success) {
      throw new Error(result.error || 'ExifTool write failed.')
    }
    taggedBlob = new Blob([result.data], { type: 'image/jpeg' })
    downloadName = filename
    still.src = URL.createObjectURL(taggedBlob)
    still.hidden = false
    preview.hidden = true
    downloadBtn.disabled = false
    const gps = tags.GPSLatitude
      ? 'GPS written from navigator.geolocation'
      : 'No geolocation fix. GPS omitted. Intake will file locality as unknown.'
    showNote(`${gps} DateTimeOriginal ${tags.DateTimeOriginal}. Download the file. Do not upload it here.`)
  } catch (error) {
    showError(error instanceof Error ? error.message : 'Capture failed.')
    shootBtn.disabled = false
  }
}

function download() {
  if (!taggedBlob) return
  const href = URL.createObjectURL(taggedBlob)
  const link = document.createElement('a')
  link.href = href
  link.download = downloadName
  link.click()
  URL.revokeObjectURL(href)
}

armBtn.addEventListener('click', () => {
  void armCamera()
})
shootBtn.addEventListener('click', () => {
  void shoot()
})
downloadBtn.addEventListener('click', download)
