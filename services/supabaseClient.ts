import { createClient } from '@supabase/supabase-js';

// Hardcoded for the preview environment based on user input
const supabaseUrl = 'https://squwogczslvfeaisauje.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNxdXdvZ2N6c2x2ZmVhaXNhdWplIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY4ODQsImV4cCI6MjA5MTIzMjg4NH0.IELXEOkwXoIsxv2g6L2_HYjOwsjNTM7qeQV5ROZtbgQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
