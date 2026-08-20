import { writeMetadata } from './vendor/exiftool.js'
import { captureFilename, tagsFromCapture } from './tags.js'

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
let coords = null

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
    if (!navigator.geolocation) {
      setChip(geoChip, 'unknown', 'location unavailable')
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }
        if (!Number.isFinite(next.latitude) || !Number.isFinite(next.longitude)) {
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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    )
  })
}

async function armCamera() {
  showError('')
  taggedBlob = null
  downloadBtn.disabled = true
  still.hidden = true
  preview.hidden = false
  coords = await requestCoords()
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
    if (!coords) {
      showNote(
        'No GPS fix. The download will carry DateTimeOriginal only. Intake will file locality as unknown.',
      )
    } else {
      showNote('')
    }
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
    const jpeg = await canvasJpeg(preview)
    const filename = captureFilename(capturedAt)
    const file = new File([jpeg], filename, { type: 'image/jpeg' })
    const tags = tagsFromCapture({ capturedAt, coords })
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
    const gps = tags.GPSLatitude ? 'GPS written' : 'GPS omitted, locality unknown'
    showNote(`${gps}. DateTimeOriginal ${tags.DateTimeOriginal}. Download the file. Do not upload it here.`)
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
