'use client';

import { useParams } from 'next/navigation';
import CreatorHubDetailView from '../CreatorHubDetailView';

export default function CreatorHubDetailPage() {
  const params = useParams<{ id: string }>();
  return <CreatorHubDetailView uploadId={String(params?.id || '')} />;
}
