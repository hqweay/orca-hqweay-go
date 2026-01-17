
import { VoiceNoteRecordings, User, VoiceNote } from '../types'

const BASE_API_URL = 'https://api.voicenotes.com/api/integrations/obsidian-sync'

const API_ROUTES = {
  GET_USER: '/user/info',
  GET_VOICE_NOTE_URL: '/voicenotes',
  GET_VOICE_NOTE_SIGNED_URL: '/voicenotes/signed-url',
  GET_RECORDINGS: '/recordings',
  DELETE_RECORDING: '/recordings/:recordingId',
  GET_SIGNED_URL: '/recordings/:recordingId/signed-url',
}

type VoiceNotesApiOptions = {
  token?: string
  lastSyncedNoteUpdatedAt?: string
  deletedLocalRecordings?: Pick<VoiceNote, 'recording_id' | 'updated_at'>[]
}

export class VoiceNotesApi {
  private token?: string
  private lastSyncedNoteUpdatedAt?: string
  private deletedLocalRecordings: Pick<
    VoiceNote,
    'recording_id' | 'updated_at'
  >[] = []

  constructor(options: VoiceNotesApiOptions = {}) {
    if (options.token) {
      this.token = options.token
    }

    if (options.lastSyncedNoteUpdatedAt) {
      this.lastSyncedNoteUpdatedAt = options.lastSyncedNoteUpdatedAt
    }

    if (options.deletedLocalRecordings) {
      this.deletedLocalRecordings = options.deletedLocalRecordings
    }
  }

  setToken(token: string | undefined | null): void {
    this.token = token || undefined
  }

  private hasValidToken(): boolean {
    return !!(this.token && this.token.trim().length > 0)
  }

  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
      return endpoint
    }
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${BASE_API_URL}${cleanEndpoint}`
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private async makeAuthenticatedRequest(
    endpoint: string,
    options: Partial<RequestInit> = {},
    retryCount = 0,
  ): Promise<any> {
    if (!this.hasValidToken()) {
      throw new Error('No valid authentication token')
    }

    const url = this.buildUrl(endpoint)
    const headers = {
      ...options.headers,
      Authorization: `Bearer ${this.token}`,
      'X-API-KEY': `${this.token}`,
      'Content-Type': 'application/json',
    }

    const fetchOptions: RequestInit = {
      method: options.method || 'GET',
      headers,
      body: options.body,
    }

    const res = await fetch(url, fetchOptions)

    if (res.ok) {
      return await res.json()
    }

    if (res.status === 401) {
      this.token = undefined
      throw {
        status: res.status,
        message: 'Authentication failed - token invalid or expired',
      }
    }

    if (res.status === 429) {
      const maxRetries = 3
      if (retryCount >= maxRetries) {
        throw {
          status: res.status,
          message: 'Rate limit exceeded. Please try again later.',
        }
      }
      const retryAfter = res.headers.get('Retry-After')
      let waitTime: number
      if (retryAfter) {
        const retryAfterNum = parseInt(retryAfter, 10)
        if (!isNaN(retryAfterNum)) {
          waitTime = retryAfterNum * 1000
        } else {
          const retryDate = new Date(retryAfter)
          waitTime = Math.max(0, retryDate.getTime() - Date.now())
        }
      } else {
        waitTime = Math.pow(2, retryCount) * 1000
      }
      waitTime = Math.min(waitTime, 60000)
      console.log(`Rate limited. Waiting ${waitTime}ms...`)
      await this.sleep(waitTime)
      return this.makeAuthenticatedRequest(endpoint, options, retryCount + 1)
    }

    const errorBody = await res.text()
    throw {
      status: res.status,
      message: `Request failed: ${res.statusText}. ${errorBody}`,
    }
  }

  async getRecordings(): Promise<VoiceNoteRecordings | null> {
    if (!this.hasValidToken()) {
      return null
    }

    try {
      const options: Partial<RequestInit> = {
        body: JSON.stringify({
          obsidian_deleted_recording_ids: this.deletedLocalRecordings.map(
            (r) => r.recording_id,
          ),
          last_synced_note_updated_at: this.lastSyncedNoteUpdatedAt,
        }),
        method: 'POST',
      }

      const data = await this.makeAuthenticatedRequest(
        API_ROUTES.GET_RECORDINGS,
        options,
      )
      return data as VoiceNoteRecordings
    } catch (error) {
      console.error('Failed to get recordings:', error)
      throw error
    }
  }

  async getRecordingsFromLink(
    link: string,
  ): Promise<VoiceNoteRecordings | null> {
    if (!this.hasValidToken()) {
      return null
    }

    try {
      const options: Partial<RequestInit> = {
        method: 'POST',
      }
      const data = await this.makeAuthenticatedRequest(link, options)
      return data as VoiceNoteRecordings
    } catch (error) {
      console.error('Failed to get recordings from link:', error)
      throw error
    }
  }

  async getUserInfo(): Promise<User | null> {
    if (!this.hasValidToken()) {
      return null
    }

    try {
      const data = await this.makeAuthenticatedRequest(API_ROUTES.GET_USER)
      return data as User
    } catch (error) {
      console.error('Failed to get user info:', error)
      return null
    }
  }
}
