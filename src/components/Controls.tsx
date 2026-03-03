import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Period } from './Dashboard';
import { AlertConfig, AlertDirection } from '@/lib/priceAlerts';
import { ChevronDown, ChevronUp, Settings2, Bell } from 'lucide-react';

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
    period: Period;
    setPeriod: (val: Period) => void;
    customStart: string;
    setCustomStart: (val: string) => void;
    customEnd: string;
    setCustomEnd: (val: string) => void;
    alertConfig: AlertConfig;
    setAlertConfig: (val: AlertConfig) => void;
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
    period,
    setPeriod,
    customStart,
    setCustomStart,
    customEnd,
    setCustomEnd,
    alertConfig,
    setAlertConfig
}: ControlsProps) {
    const [isMobileOpen, setIsMobileOpen] = useState(false);

    return (
        <div className="bg-zinc-900/40 p-4 md:p-5 rounded-2xl border border-zinc-800/50 hover:border-zinc-700/80 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)] backdrop-blur-2xl transition-all duration-500 h-full flex flex-col justify-center hover:-translate-y-0.5">

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
            <div className={`${isMobileOpen ? 'flex' : 'hidden'} md:flex flex-col space-y-4 mt-4 md:mt-0 pt-4 md:pt-0 border-t border-zinc-800/50 md:border-0`}>

                {/* Top Row: Period & Price Alert */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">

                    {/* Period Selector & Custom Dates */}
                    <div className="flex flex-col space-y-2">
                        <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Period</Label>
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <select
                                    value={period}
                                    onChange={(e) => setPeriod(e.target.value as Period)}
                                    className="appearance-none bg-zinc-800/50 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-800/80 focus:outline-none focus:ring-1 focus:ring-green-500/50 rounded-lg px-4 py-1.5 pr-8 text-sm font-medium transition-colors cursor-pointer"
                                >
                                    <option value="yesterday">Yesterday</option>
                                    <option value="today">Today</option>
                                    <option value="tomorrow">Tomorrow</option>
                                    <option value="this_week">Current Week</option>
                                    <option value="next_week">Next Week</option>
                                    <option value="week">Past Week</option>
                                    <option value="month">Past Month</option>
                                    <option value="quarter">Past Quarter</option>
                                    <option value="custom">Custom Range</option>
                                </select>
                                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                            </div>

                            {period === 'custom' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="date"
                                        value={customStart}
                                        onChange={(e) => setCustomStart(e.target.value)}
                                        className="bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    />
                                    <span className="text-zinc-500 text-sm">to</span>
                                    <input
                                        type="date"
                                        value={customEnd}
                                        onChange={(e) => setCustomEnd(e.target.value)}
                                        className="bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Price Alert Settings */}
                    <div className="flex flex-col space-y-2">
                        <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Price Alert</Label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setAlertConfig({ ...alertConfig, enabled: !alertConfig.enabled })}
                                className={`px-3 py-1.5 rounded-lg text-sm transition-all border flex items-center gap-1.5 ${alertConfig.enabled ? 'bg-yellow-400/20 text-yellow-300 border-yellow-400/50' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700 hover:bg-zinc-800'}`}
                            >
                                <Bell className="w-3.5 h-3.5" />
                                Alert
                            </button>

                            {alertConfig.enabled && (
                                <div className="flex items-center gap-2">
                                    <div className="relative">
                                        <select
                                            value={alertConfig.direction}
                                            onChange={(e) => setAlertConfig({ ...alertConfig, direction: e.target.value as AlertDirection })}
                                            className="appearance-none bg-zinc-800/50 text-zinc-200 border border-zinc-700/80 hover:bg-zinc-800/80 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 rounded-lg px-3 py-1.5 pr-8 text-sm font-medium transition-colors cursor-pointer"
                                        >
                                            <option value="below">Below</option>
                                            <option value="above">Above</option>
                                        </select>
                                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
                                    </div>
                                    <input
                                        type="number"
                                        step="0.5"
                                        min="0"
                                        value={alertConfig.threshold}
                                        onChange={(e) => setAlertConfig({ ...alertConfig, threshold: parseFloat(e.target.value) || 0 })}
                                        className="w-20 bg-zinc-800/50 border border-zinc-700/80 text-zinc-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-center"
                                    />
                                    <span className="text-zinc-500 text-sm whitespace-nowrap">¢/kWh</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Advanced Settings Content */}
                <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center pt-4 pb-2 border-t border-zinc-800/50 mt-4">
                    {/* Statistical Overlays */}
                    <div className="flex flex-col space-y-2 w-full md:w-auto">
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
                    <div className="flex flex-col space-y-2 w-full md:w-auto mt-2 xl:mt-0">
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
        </div>
    );
}
