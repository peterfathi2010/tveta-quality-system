export interface Review {
  id: string;
  title: string;
  category: string;
  status: 'Pass' | 'Fail' | 'Pending';
  date: string;
  reviewer: string;
  score: number;
  notes?: string;
}

export type ViewState = 'dashboard' | 'reviews' | 'new';
