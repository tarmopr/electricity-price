import { ElectricityPrice, applyVat } from "@/lib/api";
import { ArrowDown, ArrowUp, Zap } from "lucide-react";

interface CurrentPriceCardProps {
    currentPrice: ElectricityPrice | null;
    previousPrice?: ElectricityPrice | null;
    includeVat: boolean;
}

export default function CurrentPriceCard({ currentPrice, previousPrice, includeVat }: CurrentPriceCardProps) {
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

    const isUp = previousValue ? priceValue > previousValue : false;
    const isDown = previousValue ? priceValue < previousValue : false;
    const diff = previousValue ? Math.abs(priceValue - previousValue) : 0;

    return (
        <div className="p-4 lg:p-6 rounded-2xl bg-gradient-to-br from-zinc-900/80 to-zinc-950/80 border border-zinc-800/50 shadow-2xl backdrop-blur-xl relative overflow-hidden group hover:border-zinc-700/50 transition-all duration-500 h-full flex flex-col justify-center">

            {/* Decorative background glow */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-500/10 rounded-full blur-3xl group-hover:bg-green-500/20 transition-all duration-700"></div>

            <div className="flex items-center space-x-2 text-zinc-400 mb-1 lg:mb-2 relative z-10">
                <Zap className="w-4 h-4 text-green-400 shrink-0" />
                <h2 className="text-xs lg:text-sm font-medium tracking-wide uppercase">Current Price</h2>
            </div>

            <div className="flex items-baseline space-x-2 lg:space-x-3 relative z-10">
                <div className="text-4xl lg:text-5xl font-bold tracking-tighter text-white">
                    {priceValue.toFixed(2)}
                </div>
                <div className="text-base lg:text-lg font-medium text-zinc-500">
                    ¢/kWh
                </div>
            </div>

            {previousValue && (
                <div className="flex items-center mt-2 lg:mt-4 space-x-1.5 text-xs lg:text-sm relative z-10">
                    {isUp && <ArrowUp className="w-3 h-3 lg:w-4 lg:h-4 text-red-400" />}
                    {isDown && <ArrowDown className="w-3 h-3 lg:w-4 lg:h-4 text-green-400" />}
                    {!isUp && !isDown && <div className="w-3 h-3 lg:w-4 lg:h-4 flex items-center justify-center text-zinc-500">-</div>}

                    <span className={isUp ? 'text-red-400 font-medium' : isDown ? 'text-green-400 font-medium' : 'text-zinc-500'}>
                        {diff.toFixed(2)}¢
                    </span>
                    <span className="text-zinc-500">vs previous hour</span>
                </div>
            )}
        </div>
    );
}
