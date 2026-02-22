import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Timeframe } from './Dashboard';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

interface ControlsProps {
    includeVat: boolean;
    setIncludeVat: (val: boolean) => void;
    showNow: boolean;
    setShowNow: (val: boolean) => void;
    showMean: boolean;
    setShowMean: (val: boolean) => void;
    showMedian: boolean;
    setShowMedian: (val: boolean) => void;
    showP75: boolean;
    setShowP75: (val: boolean) => void;
    showP90: boolean;
    setShowP90: (val: boolean) => void;
    showP95: boolean;
    setShowP95: (val: boolean) => void;
    timeframe: Timeframe;
    setTimeframe: (val: Timeframe) => void;
    customStart: string;
    setCustomStart: (val: string) => void;
    customEnd: string;
    setCustomEnd: (val: string) => void;
}

export default function Controls({
    includeVat,
    setIncludeVat,
    showNow,
    setShowNow,
    showMean,
    setShowMean,
    showMedian,
    setShowMedian,
    showP75,
    setShowP75,
    showP90,
    setShowP90,
    showP95,
    setShowP95,
    timeframe,
    setTimeframe,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd
}: ControlsProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="bg-zinc-900/40 p-4 md:p-5 rounded-2xl border border-zinc-800/50 backdrop-blur-md transition-all duration-300 h-full flex flex-col justify-center">

            {/* Mobile Toggle Button */}
            <button
                onClick={() => setIsMobileOpen(!isMobileOpen)}
                className="md:hidden w-full flex items-center justify-between text-zinc-400 hover:text-zinc-200 transition-colors pb-2"
            >
                <div className="flex items-center space-x-2">
                    <Settings2 className="w-4 h-4" />
                    <span className="text-sm font-medium">Chart Controls</span>
                </div>
                {isMobileOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </button>

            {/* The Controls Content */}
            <div className={`${isMobileOpen ? 'flex' : 'hidden'} md:flex flex-col space-y-6 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-zinc-800/50 md:border-0`}>

                {/* Top Row: Timeframe & Dates */}
                <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                    <div className="flex flex-col space-y-2 w-full">
                        <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Timeframe</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            {(['yesterday', 'today', 'tomorrow', 'week', 'month', 'year', 'custom'] as Timeframe[]).map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => setTimeframe(tf)}
                                    className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${timeframe === tf ? 'bg-green-400/20 text-green-300 border-green-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                                >
                                    {tf.charAt(0).toUpperCase() + tf.slice(1)}
                                </button>
                            ))}
                            {timeframe === 'custom' && (
                                <div className="flex flex-wrap items-center gap-2 ml-0 md:ml-2">
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="bg-zinc-800/80 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-500"
                                    />
                                    <span className="text-zinc-500 text-sm font-medium">to</span>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="bg-zinc-800/80 border border-zinc-700 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500 placeholder-zinc-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Row: Stats & VAT */}
                <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center pt-4 border-t border-zinc-800/50">

                    {/* Statistical Overlays */}
                    <div className="flex flex-col space-y-2 w-full md:w-auto">
                        <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Statistical Lines</Label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setShowNow(!showNow)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showNow ? 'bg-blue-400/20 text-blue-300 border-blue-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                Now
                            </button>
                            <button
                                onClick={() => setShowMean(!showMean)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showMean ? 'bg-amber-400/20 text-amber-300 border-amber-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                Mean
                            </button>
                            <button
                                onClick={() => setShowMedian(!showMedian)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showMedian ? 'bg-red-400/20 text-red-300 border-red-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                Median
                            </button>
                            <button
                                onClick={() => setShowP75(!showP75)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showP75 ? 'bg-purple-400/20 text-purple-300 border-purple-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                75th Pctl
                            </button>
                            <button
                                onClick={() => setShowP90(!showP90)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showP90 ? 'bg-pink-400/20 text-pink-300 border-pink-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                90th Pctl
                            </button>
                            <button
                                onClick={() => setShowP95(!showP95)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${showP95 ? 'bg-orange-400/20 text-orange-300 border-orange-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                95th Pctl
                            </button>

                        </div>
                    </div>

                    {/* VAT Toggle */}
                    <div className="flex flex-col space-y-2 w-full md:w-auto">
                        <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Taxes</Label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setIncludeVat(!includeVat)}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border ${includeVat ? 'bg-green-400/20 text-green-300 border-green-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                Include VAT (22%)
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div >
    );
}
