import { Switch } from '@headlessui/react';
import { Label } from '@/components/ui/label';

interface ControlsProps {
    includeVat: boolean;
    setIncludeVat: (val: boolean) => void;
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
}

export default function Controls({
    includeVat,
    setIncludeVat,
    showMean,
    setShowMean,
    showMedian,
    setShowMedian,
    showP75,
    setShowP75,
    showP90,
    setShowP90,
    showP95,
    setShowP95
}: ControlsProps) {
    return (
        <div className="bg-zinc-900/40 p-5 rounded-2xl border border-zinc-800/50 backdrop-blur-md">
            <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">

                {/* VAT Toggle */}
                <div className="flex items-center space-x-3">
                    <Switch
                        checked={includeVat}
                        onChange={setIncludeVat}
                        className={`${includeVat ? 'bg-green-500' : 'bg-zinc-700'
                            } relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-zinc-950`}
                    >
                        <span className="sr-only">Include VAT</span>
                        <span
                            className={`${includeVat ? 'translate-x-6' : 'translate-x-1'
                                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                        />
                    </Switch>
                    <Label className="text-zinc-300 font-medium">Include VAT (22%)</Label>
                </div>

                {/* Statistical Overlays */}
                <div className="flex flex-col space-y-2 w-full md:w-auto">
                    <Label className="text-xs text-zinc-500 uppercase tracking-wider font-semibold">Statistical Lines</Label>
                    <div className="flex flex-wrap gap-2">

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
            </div>
        </div>
    );
}
