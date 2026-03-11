/**
 * Full-layout skeleton for the Dashboard loading state.
 * Mirrors the exact structure of the loaded Dashboard to prevent CLS
 * (Cumulative Layout Shift) and give users an immediate sense of the layout.
 */
export default function DashboardSkeleton() {
    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-pulse" aria-busy="true" aria-label="Loading market data">

            {/* Top Row: Price Card + Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Current Price Card skeleton */}
                <div className="lg:col-span-1 border-b border-zinc-800 pb-4 lg:border-none lg:pb-0 h-full">
                    <div className="p-4 lg:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm h-full min-h-[120px] flex flex-col justify-center gap-3">
                        {/* Label */}
                        <div className="h-3.5 w-28 bg-zinc-800 rounded-full" />
                        {/* Big price number */}
                        <div className="h-10 w-36 bg-zinc-800 rounded-lg" />
                        {/* Sub-row: prev / next indicators */}
                        <div className="flex gap-3">
                            <div className="h-3 w-16 bg-zinc-800 rounded-full" />
                            <div className="h-3 w-16 bg-zinc-800 rounded-full" />
                        </div>
                    </div>
                </div>

                {/* Controls skeleton */}
                <div className="lg:col-span-2 h-full">
                    <div className="bg-zinc-900/40 p-4 md:p-5 rounded-2xl border border-zinc-800/50 backdrop-blur-2xl h-full flex flex-col justify-center gap-4">
                        {/* Period pills row */}
                        <div className="flex flex-wrap gap-2">
                            {[80, 64, 72, 88, 56].map((w, i) => (
                                <div key={i} className={`h-7 w-${w === 56 ? '14' : w === 64 ? '16' : w === 72 ? '[4.5rem]' : w === 80 ? '20' : '22'} bg-zinc-800 rounded-full`} />
                            ))}
                        </div>
                        {/* Stat overlay pills row */}
                        <div className="flex flex-wrap gap-2">
                            {[3, 4, 4, 5].map((_, i) => (
                                <div key={i} className="h-7 w-20 bg-zinc-800 rounded-full" />
                            ))}
                        </div>
                        {/* VAT toggle + alert row */}
                        <div className="flex gap-3">
                            <div className="h-7 w-24 bg-zinc-800 rounded-full" />
                            <div className="h-7 w-20 bg-zinc-800 rounded-full" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart / Heatmap area */}
            <div className="bg-zinc-900/40 p-2 sm:p-6 rounded-3xl border border-zinc-800/80 backdrop-blur-2xl">
                {/* View toggle bar */}
                <div className="flex items-center justify-between px-2 sm:px-0 mb-4">
                    <div className="flex gap-2">
                        <div className="h-7 w-16 bg-zinc-800 rounded-full" />
                        <div className="h-7 w-20 bg-zinc-800 rounded-full" />
                    </div>
                    {/* Share button placeholder */}
                    <div className="h-7 w-16 bg-zinc-800 rounded-full" />
                </div>
                {/* Chart area */}
                <div className="h-[300px] sm:h-[360px] rounded-2xl bg-zinc-800/40 flex items-end gap-1 px-4 pb-6 overflow-hidden">
                    {/* Faux bars to hint at a bar/area chart */}
                    {[40, 65, 50, 80, 55, 70, 45, 85, 60, 75, 50, 90, 65, 55, 70, 48, 82, 58, 72, 44, 88, 62, 76, 52].map((h, i) => (
                        <div
                            key={i}
                            className="flex-1 bg-zinc-700/50 rounded-t-sm"
                            style={{ height: `${h}%` }}
                        />
                    ))}
                </div>
            </div>

        </div>
    );
}
