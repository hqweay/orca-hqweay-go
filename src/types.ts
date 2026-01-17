/* -------------------------------------------------------------------------- */
/*                                    MAIN                                    */
/* -------------------------------------------------------------------------- */

export interface VoiceNotesPluginSettings {
  token?: string
  inboxName: string
  noteTag: string
}

export interface User {
  name: string
  email: string
  photo_url: string | null
}

/* -------------------------------------------------------------------------- */
/*                               VOICENOTES API                               */
/* -------------------------------------------------------------------------- */

export interface VoiceNoteSignedUrl {
  url: string
}

export interface VoiceNoteAttachment {
  id: string
  type: number
  description: string
  url: string
  created_at: string
}

export interface VoiceNoteCreation {
  id: string
  type: string
  content: { data: string[] }
  markdown_content: string
  title?: string
}

export interface VoiceNote {
  id: string
  recording_id: string
  title: string
  duration: number
  transcript: string
  related_notes: VoiceNote[]
  tags: { name: string }[]
  creations: VoiceNoteCreation[]
  subnotes: VoiceNote[]
  attachments: VoiceNoteAttachment[]
  created_at: string
  updated_at: string
}

export interface VoiceNoteRecordings {
  data: VoiceNote[]
  links: {
    next?: string
  }
}
