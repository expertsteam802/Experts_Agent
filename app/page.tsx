import { Navbar } from '@/components/navbar';
import { Builder } from '@/components/builder';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      <Builder />
    </div>
  );
}