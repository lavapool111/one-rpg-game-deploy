'use client';

import { memo, type ReactNode } from 'react';
import { getRarityColor, getRarityBorderColor, getRarityBgColor } from '@/lib/game/inventory';

interface InventorySlotProps {
    name: string;
    quantity: number;
    rarity?: string;
    description: string;
    isSelected?: boolean;
    isEquipped?: boolean;
    onHover: (hovering: boolean) => void;
    onClick: () => void;
}

export const InventorySlot = memo(function InventorySlot({ name, quantity, rarity = 'common', description, isSelected, isEquipped, onHover, onClick }: InventorySlotProps) {
    const borderColor = isSelected ? 'border-yellow-400' : getRarityBorderColor(rarity);
    const bgColor = isSelected ? 'bg-yellow-900/20' : getRarityBgColor(rarity);
    const textColor = getRarityColor(rarity);

    return (
        <div
            className={`relative p-2 rounded-lg border-2 ${borderColor} ${bgColor} flex flex-col items-center justify-center aspect-square cursor-pointer transition-all hover:scale-105 active:scale-95 group shadow-sm`}
            onMouseEnter={() => onHover(true)}
            onMouseLeave={() => onHover(false)}
            onClick={onClick}
        >
            {isEquipped && (
                <div className="absolute -top-1 -right-1 bg-yellow-500 text-black text-[8px] font-bold px-1 rounded shadow-sm z-10">
                    E
                </div>
            )}
            <div className={`text-xs font-bold text-center truncate w-full ${textColor}`}>
                {name}
            </div>
            {quantity > 1 && (
                <div className="absolute bottom-1 right-2 text-[10px] font-mono text-slate-300 bg-black/40 px-1 rounded">
                    x{quantity}
                </div>
            )}

            {/* Tooltip on hover (simplified, main tooltip is in InventoryScreen) */}
            <div className="absolute inset-0 rounded-lg bg-white/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
        </div>
    );
});

export default InventorySlot;
