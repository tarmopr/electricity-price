import { ElectricityPrice, applyVat } from "@/lib/api";
import { ArrowDown, ArrowUp, Zap } from "lucide-react";

interface CurrentPriceCardProps {
    currentPrice: ElectricityPrice | null;
    previousPrice?: ElectricityPrice | null;
    nextPrice?: ElectricityPrice | null;
    medianPrice?: number;
    includeVat: boolean;
}

export default function CurrentPriceCard({ currentPrice, previousPrice, nextPrice, medianPrice, includeVat }: CurrentPriceCardProps) {
    if (!currentPrice) {
        return (
            <div className="p-4 lg:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse h-full min-h-[120px] backdrop-blur-sm flex flex-col justify-center">
                <div className="h-4 w-24 bg-zinc-800 rounded mb-2 lg:mb-4"></div>
                <div className="h-8 lg:h-10 w-32 bg-zinc-800 rounded"></div>
            </div>
        );
    }

    const priceValue = includeVat ? applyVat(currentPrice.priceCentsKwh) : currentPrice.priceCentsKwh;
    const previousValue = previousPrice ? (includeVat ? applyVat(previousPrice.priceCentsKwh) : previousPrice.priceCentsKwh) : null;
    const nextValue = nextPrice ? (includeVat ? applyVat(nextPrice.priceCentsKwh) : nextPrice.priceCentsKwh) : null;
    const medianValue = medianPrice ?? null;

    const isUp = previousValue ? priceValue > previousValue : false;
    const isDown = previousValue ? priceValue < previousValue : false;
    const diff = previousValue ? Math.abs(priceValue - previousValue) : 0;

    const isNextUp = nextValue ? nextValue > priceValue : false;
    const isNextDown = nextValue ? nextValue < priceValue : false;
    const nextDiff = nextValue ? Math.abs(nextValue - priceValue) : 0;

    return (
        <div className="p-4 lg:p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-zinc-700/50 transition-all duration-500 h-full flex flex-col justify-center">

            {/* Decorative background glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all duration-700"></div>

            <div className="flex items-center space-x-2 text-zinc-400 mb-1 lg:mb-2 relative z-10">
                <Zap className="w-4 h-4 text-green-400 shrink-0" />
                <h2 className="text-xs lg:text-sm font-medium tracking-wide uppercase">Current Price</h2>
            </div>

            <div className="flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start w-full relative z-10 gap-x-4">
                {/* Main Price Area */}
                <div className="flex flex-col space-y-1">
                    <div className="flex items-baseline space-x-2 lg:space-x-3">
                        <div className="text-4xl lg:text-5xl font-bold tracking-tighter text-white">
                            {priceValue.toFixed(2)}
                        </div>
                        <div className="text-base lg:text-lg font-medium text-zinc-500">
                            ¢/kWh
                        </div>
                    </div>
                    {medianValue !== null && (
                        <div className="text-xs text-zinc-500 font-medium tracking-wide">
                            Median: <span className="text-zinc-400">{medianValue.toFixed(2)} ¢</span>
                        </div>
                    )}
                </div>

                {/* Comparison Area */}
                <div className="flex flex-col space-y-2 mt-0 md:mt-4 w-auto md:w-full shrink-0">
                    {previousValue && (
                        <div className="flex items-center space-x-1.5 text-xs lg:text-sm bg-zinc-900/30 rounded-lg p-2">
                            {isUp && <ArrowUp className="w-3 h-3 lg:w-4 lg:h-4 text-red-400" />}
                            {isDown && <ArrowDown className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />}
                            {!isUp && !isDown && <div className="w-3 h-3 lg:w-4 lg:h-4 flex items-center justify-center text-zinc-500">-</div>}

                            <span className={isUp ? 'text-red-400 font-medium' : isDown ? 'text-green-400 font-medium' : 'text-zinc-500'}>
                                {diff.toFixed(2)}¢
                            </span>
                            <span className="text-zinc-500 hidden sm:inline">vs previous hour</span>
                            <span className="text-zinc-500 sm:hidden">prev</span>
                        </div>
                    )}
                    {nextValue && (
                        <div className="flex items-center space-x-1.5 text-xs lg:text-sm bg-zinc-900/30 rounded-lg p-2">
                            {isNextUp && <ArrowUp className="w-3 h-3 lg:w-4 lg:h-4 text-red-400" />}
                            {isNextDown && <ArrowDown className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />}
                            {!isNextUp && !isNextDown && <div className="w-3 h-3 lg:w-4 lg:h-4 flex items-center justify-center text-zinc-500">-</div>}

                            <span className={isNextUp ? 'text-red-400 font-medium' : isNextDown ? 'text-green-400 font-medium' : 'text-zinc-500'}>
                                {nextDiff.toFixed(2)}¢
                            </span>
                            <span className="text-zinc-500 hidden sm:inline">vs next hour</span>
                            <span className="text-zinc-500 sm:hidden">next</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
