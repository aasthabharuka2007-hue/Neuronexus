export type LanguageCode = 'en' | 'hi' | 'mr'

export interface NewsArticle {
  source_id: string | null
  source_name: string | null
  author: string | null
  title: string
  description: string | null
  url: string
  url_to_image: string | null
  published_at: string | null
  content: string | null
}

export interface NewsListResponse {
  status: string
  total_results: number
  articles: NewsArticle[]
  cached: boolean
  relaxed_filters?: boolean
}

export interface SummarizeResponse {
  short_summary: string
  bullet_points: string[]
  simplified_explanation: string
  language: LanguageCode
  cached: boolean
}

export interface AnalyzeImageResponse {
  description: string
  extracted_text: string
  summary_meaning: string
}

export interface AnalyzeVideoResponse {
  transcript: string
  short_summary: string
  bullet_points: string[]
  simplified_explanation: string
}

export interface PreferencesOut {
  user_id: string
  preferred_language: LanguageCode
  favorite_categories: string | null
  voice_id: string
  theme: 'light' | 'dark' | 'system'
}
