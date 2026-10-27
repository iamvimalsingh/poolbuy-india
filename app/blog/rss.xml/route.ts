import { GET as getFeed } from '@/app/feed.xml/route';

export async function GET() {
  return getFeed();
}
