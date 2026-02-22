import Dashboard from '@/components/Dashboard';
import { Zap } from 'lucide-react';

export default function Home() {
  return (
    <main className="min-h-screen p-4 md:p-8 lg:p-12 pb-24 relative selection:bg-green-500/30">

      {/* Background Gradients */}
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-900 via-zinc-950 to-zinc-950"></div>
      <div className="fixed top-0 inset-x-0 h-[500px] -z-10 bg-gradient-to-b from-green-500/5 to-transparent pointer-events-none"></div>

      <div className="max-w-6xl mx-auto mb-6 mt-8 flex flex-col md:flex-row items-start md:items-end justify-between gap-4">
        <div className="w-full">
          <div className="flex items-center space-x-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/20">
              <Zap className="text-zinc-950 w-6 h-6" />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-500">
              Estonia Energy
            </h1>
          </div>
          <p className="text-zinc-400 mt-2 text-base md:text-lg max-w-none">
            Live Nord Pool spot market prices. <span className="hidden sm:inline">Monitor current rates, analyze trends, and plan your energy consumption.</span>
          </p>
        </div>
      </div>

      <Dashboard />

      {/* Footer Note */}
      <div className="max-w-6xl mx-auto mt-12 text-center text-sm text-zinc-600">
        Data provided by the official Elering API. Prices are shown in UTC converted to your local time.
      </div>
    </main>
  );
}
