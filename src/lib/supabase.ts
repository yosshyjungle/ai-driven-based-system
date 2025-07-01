import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: {
            eventsPerSecond: 10,
        },
    },
})

// リアルタイム接続のためのタイプ定義
export type Database = {
    public: {
        Tables: {
            Session: {
                Row: {
                    id: string
                    title: string
                    teacherId: string
                    createdAt: string
                    updatedAt: string
                }
                Insert: {
                    id?: string
                    title: string
                    teacherId: string
                    createdAt?: string
                    updatedAt?: string
                }
                Update: {
                    id?: string
                    title?: string
                    teacherId?: string
                    createdAt?: string
                    updatedAt?: string
                }
            }
            TeacherCode: {
                Row: {
                    id: string
                    sessionId: string
                    content: string
                    updatedAt: string
                }
                Insert: {
                    id?: string
                    sessionId: string
                    content?: string
                    updatedAt?: string
                }
                Update: {
                    id?: string
                    sessionId?: string
                    content?: string
                    updatedAt?: string
                }
            }
            StudentCode: {
                Row: {
                    id: string
                    sessionId: string
                    studentId: string
                    content: string
                    updatedAt: string
                }
                Insert: {
                    id?: string
                    sessionId: string
                    studentId: string
                    content?: string
                    updatedAt?: string
                }
                Update: {
                    id?: string
                    sessionId?: string
                    studentId?: string
                    content?: string
                    updatedAt?: string
                }
            }
        }
    }
} 