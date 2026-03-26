'use client';

import React from 'react';

interface TabProps<T extends string> {
    tabs: readonly T[];
    activeTab: T;
    onTabChange: (tab: T) => void;
    getLabel: (tab: T) => string;
}

export function CategoryTabs<T extends string>({ tabs, activeTab, onTabChange, getLabel }: TabProps<T>) {
    return (
        <div className="flex gap-2 mb-6 border-b border-slate-700/50">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    onClick={() => onTabChange(tab)}
                    className={`px-4 py-2 text-sm font-bold uppercase tracking-widest transition-all relative ${activeTab === tab
                        ? 'text-yellow-500'
                        : 'text-slate-500 hover:text-slate-300'
                        }`}
                >
                    {getLabel(tab)}
                    {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]" />
                    )}
                </button>
            ))}
        </div>
    );
}

export function SubTabs<T extends string>({ tabs, activeTab, onTabChange, getLabel }: TabProps<T>) {
    return (
        <div className="flex gap-2 border-b border-slate-700 pb-2 mb-4">
            {tabs.map((tab) => (
                <button
                    key={tab}
                    onClick={() => onTabChange(tab)}
                    className={`px-3 py-1 text-xs font-medium rounded-t transition-colors ${activeTab === tab
                        ? 'bg-yellow-600/30 text-yellow-400 border-b-2 border-yellow-500'
                        : 'text-slate-400 hover:text-slate-200'
                        }`}
                >
                    {getLabel(tab)}
                </button>
            ))}
        </div>
    );
}
