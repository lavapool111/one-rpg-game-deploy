'use client';

import React from 'react';

interface EquippedItemSummaryProps {
    title: string;
    slotIndex?: number;
    textClass: string; // e.g., 'text-yellow-500'
    borderClass: string; // e.g., 'border-yellow-600/30'
    onUnequip: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    gridCols?: number;
}

export function EquippedItemSummary({
    title,
    slotIndex,
    textClass,
    borderClass,
    onUnequip,
    children,
    footer,
    gridCols = 2
}: EquippedItemSummaryProps) {
    const gridClass = gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2';

    return (
        <div className={`p-3 rounded-lg border ${borderClass} bg-slate-800/50`}>
            <div className="flex items-center justify-between mb-2">
                <span className={`${textClass} font-semibold truncate flex-1 mr-2`}>
                    {title} {slotIndex !== undefined && slotIndex >= 0 && `(Slot ${slotIndex + 1})`}
                </span>
                <button
                    onClick={onUnequip}
                    className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800 text-red-400 rounded transition-colors whitespace-nowrap"
                >
                    Unequip
                </button>
            </div>
            <div className={`grid ${gridClass} gap-2 text-xs`}>
                {children}
            </div>
            {footer && <div className="mt-2 text-[10px] border-t border-slate-700/50 pt-1">{footer}</div>}
        </div>
    );
}

export default EquippedItemSummary;
