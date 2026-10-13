import { loadPaperIndex } from '@/lib/server-data';
import HomeDashboard from '@/components/HomeDashboard';

export default function HomePage() {
  const metas = loadPaperIndex();
  return <HomeDashboard metas={metas} />;
}
