'use client';

import { useEffect, useState, useMemo } from 'react';
import { usePlayerStore, getTerms, getAbilityName, getSlotMultiplier } from '@/lib/store/playerStore';
import { useAccessoryStore } from '@/lib/store/accessoryStore';
import { getReedData, getLigatureData, getLigatureStats, getMouthpieceData, getMouthpieceStats, getCaseData, getCaseStats, getEnchantmentData, ENCHANTMENT_SLOT_LEVELS, MELD_TYPE_INFO, getMeldStats } from '@/lib/game/inventory';
import { getRarityColor } from '@/lib/game/inventory';
import { ABILITY_UPGRADES_UNLOCK_LEVEL } from '@/lib/game/abilityUpgrades';
import { WEAPON_TIER_DAMAGE_MULTIPLIERS, WeaponMeldType, WEAPON_MELD_TYPE_INFO } from '@/lib/game/inventoryData';

interface StatsScreenProps {
    onClose: () => void;
}

export function StatsScreen({ onClose }: StatsScreenProps) {
    // Player basic stats - access individual properties from playerStore
    const level = usePlayerStore((state) => state.level);
    const maxHealth = usePlayerStore((state) => state.maxHealth);
    const damage = usePlayerStore((state) => state.damage);
    const basicAttackDamage = usePlayerStore((state) => state.basicAttackDamage);
    const speed = usePlayerStore((state) => state.speed);
    const critChance = usePlayerStore((state) => state.critChance);
    const superCritChance = usePlayerStore((state) => state.superCritChance);
    const critFactor = useAccessoryStore((state) => state.critFactor);
    const defense = usePlayerStore((state) => state.defense);
    const impact = usePlayerStore((state) => state.impact);
    const playerClass = usePlayerStore((state) => state.playerClass);
    const playerName = usePlayerStore((state) => state.playerName);
    const terms = getTerms(playerClass);
    const abilityName = getAbilityName(playerClass);

    // Accessories
    const equippedReed = useAccessoryStore((state) => state.equippedReed);
    const reedSlot = useAccessoryStore((state) => state.reedSlot);
    const equippedLigature = useAccessoryStore((state) => state.equippedLigature);
    const ligatureSlot = useAccessoryStore((state) => state.ligatureSlot);
    const equippedMouthpiece = useAccessoryStore((state) => state.equippedMouthpiece);
    const mouthpieceSlot = useAccessoryStore((state) => state.mouthpieceSlot);
    const equippedCase = useAccessoryStore((state) => state.equippedCase);
    const caseSlot = useAccessoryStore((state) => state.caseSlot);
    const getMeldBonus = useAccessoryStore((state) => state.getMeldBonus);
    // Weapon Meld
    const weaponMeldType = useAccessoryStore((state) => state.weaponMeldType);
    const weaponMeldTier = useAccessoryStore((state) => state.weaponMeldTier);
    const getWeaponMeldBonus = useAccessoryStore((state) => state.getWeaponMeldBonus);

    // Enchantments
    const equippedEnchantments = useAccessoryStore((state) => state.equippedEnchantments);
    const embouchure = usePlayerStore((state) => state.embouchure);

    // Ability Upgrades
    const abilityUpgrades = usePlayerStore((state) => state.abilityUpgrades);
    const isUpgradesUnlocked = level >= ABILITY_UPGRADES_UNLOCK_LEVEL;
    const getAbilityUpgradeStats = usePlayerStore((state) => state.getAbilityUpgradeStats);

    // Calculated bonuses
    const reedSlotMultiplier = reedSlot >= 0 ? getSlotMultiplier(reedSlot) : 1;
    const ligatureSlotMultiplier = ligatureSlot >= 0 ? getSlotMultiplier(ligatureSlot) : 1;
    const mouthpieceSlotMultiplier = mouthpieceSlot >= 0 ? getSlotMultiplier(mouthpieceSlot) : 1;
    const caseSlotMultiplier = caseSlot >= 0 ? getSlotMultiplier(caseSlot) : 1;

    // Memoize all stat derivations to prevent redundant work during staggered rendering
    const derivedStats = useMemo(() => {
        // Ability Upgrade stats
        const abilityUpgradeStatsValue = getAbilityUpgradeStats();

        // Ligature stats
        const ligatureStats = equippedLigature ? getLigatureStats(equippedLigature.id, equippedLigature.level) : null;

        // Mouthpiece stats
        const mouthpieceStats = equippedMouthpiece ? getMouthpieceStats(equippedMouthpiece.id, equippedMouthpiece.level) : null;

        // Case stats
        const caseStats = equippedCase ? getCaseStats(equippedCase.id, equippedCase.level) : null;

        // Calculate total against-type bonuses
        let trumpetDamageMult = 1;
        let euphoniumDefenseBonus = 0;
        let hornRetaliationDamage = 0;

        // From enchantments
        Object.values(equippedEnchantments).forEach((enchant) => {
            if (enchant) {
                const data = getEnchantmentData(enchant.id, enchant.tier);
                if (data.trumpetDamageMultiplier) trumpetDamageMult *= data.trumpetDamageMultiplier;
                if (data.euphoniumDefenseBonus) euphoniumDefenseBonus += data.euphoniumDefenseBonus;
                if (data.hornRetaliationDamage) hornRetaliationDamage += data.hornRetaliationDamage;
            }
        });

        const ligatureSlotMultiplier = ligatureSlot >= 0 ? getSlotMultiplier(ligatureSlot) : 1;
        const tubaDamageBonus = ligatureStats ? ligatureStats.tubaDamageBonus * ligatureSlotMultiplier : 0;

        // Calculate total crit factor (from store + enchantments)
        let totalCritFactorValue = critFactor;
        Object.values(equippedEnchantments).forEach((enchant) => {
            if (enchant) {
                const data = getEnchantmentData(enchant.id, enchant.tier);
                if (data.critFactorBonus) totalCritFactorValue += data.critFactorBonus;
            }
        });

        // Calculate defense
        let totalDefenseValue = defense;
        Object.values(equippedEnchantments).forEach((enchant) => {
            if (enchant) {
                const data = getEnchantmentData(enchant.id, enchant.tier);
                if (data.defenseBonus) totalDefenseValue += data.defenseBonus;
            }
        });

        // Calculate meld bonuses
        const meldBonus = getMeldBonus();
        totalDefenseValue += meldBonus.defense;

        const weaponMeldBonus = getWeaponMeldBonus();

        return {
            abilityUpgradeStats: abilityUpgradeStatsValue,
            ligatureStats,
            mouthpieceStats,
            caseStats,
            trumpetDamageMult,
            euphoniumDefenseBonus,
            hornRetaliationDamage,
            tubaDamageBonus,
            totalCritFactor: totalCritFactorValue,
            totalDefense: totalDefenseValue,
            meldBonus,
            weaponMeldBonus
        };
    }, [
        getAbilityUpgradeStats, equippedLigature, equippedMouthpiece, equippedCase, equippedEnchantments,
        critFactor, defense, ligatureSlot, getMeldBonus
    ]);

    const {
        abilityUpgradeStats,
        ligatureStats,
        mouthpieceStats,
        caseStats,
        trumpetDamageMult,
        euphoniumDefenseBonus,
        hornRetaliationDamage,
        tubaDamageBonus,
        totalCritFactor,
        totalDefense,
        meldBonus,
        weaponMeldBonus
    } = derivedStats;

    // Staggered rendering phase (0 to 6)
    const [renderPhase, setRenderPhase] = useState(0);
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        let frame: number;
        let phase = 0;
        const nextPhase = () => {
            if (phase < 6) {
                phase++;
                setRenderPhase(phase);
                frame = requestAnimationFrame(nextPhase);
            }
        };
        frame = requestAnimationFrame(nextPhase);
        return () => cancelAnimationFrame(frame);
    }, []);

    const handleClose = () => {
        if (isClosing) return;
        setIsClosing(true);

        // Staggered close over 2-3 frames
        let frameIdx = 0;
        const closeFrames = () => {
            frameIdx++;
            if (frameIdx < 3) {
                setRenderPhase(prev => Math.max(0, prev - 1));
                requestAnimationFrame(closeFrames);
            } else {
                onClose();
            }
        };
        requestAnimationFrame(closeFrames);
    };

    // Escape key handler
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') {
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const StatRow = ({ label, value, subtext, color = 'text-slate-200' }: { label: string; value: string | number; subtext?: string; color?: string }) => (
        <div className="flex justify-between items-center py-2 border-b border-slate-700/50 last:border-0">
            <span className="text-slate-400 text-sm">{label}</span>
            <div className="text-right">
                <span className={`font-bold ${color}`}>{value}</span>
                {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
            </div>
        </div>
    );

    const SectionHeader = ({ title, icon }: { title: string; icon: string }) => (
        <h3 className="text-yellow-500 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
            <span>{icon}</span> {title}
        </h3>
    );

    const EmptySlot = ({ text }: { text: string }) => (
        <div className="text-slate-600 text-sm italic">{text}</div>
    );

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-150 ${isClosing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'} ${renderPhase === 0 ? 'bg-black/0' : 'bg-black/70 backdrop-blur-sm'}`}>
            <div className="bg-slate-900/95 border border-yellow-600/30 rounded-xl max-w-3xl w-full mx-4 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-yellow-600/20 bg-slate-800/50 flex-shrink-0">
                    <h2 className="text-2xl font-bold text-yellow-500 tracking-wider uppercase flex items-center gap-2">
                        <span>📊</span> Character Stats
                    </h2>
                    <button
                        onClick={handleClose}
                        className="text-slate-400 hover:text-white transition-colors text-2xl font-bold"
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    {renderPhase >= 1 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Left Column - Core Stats */}
                            <div className="space-y-4">
                                {/* Level & Class */}
                                <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                    <SectionHeader title="Character" icon="👤" />
                                    <StatRow label="Name" value={playerName || (playerClass === 'bb_clarinet' ? 'Bb Clarinet' : 'Viola')} color="text-yellow-400" />
                                    <StatRow label="Level" value={level} color="text-yellow-400" />
                                    <StatRow label="Class" value={playerClass === 'bb_clarinet' ? 'Bb Clarinet' : 'Viola'} color="text-blue-400" />
                                    <StatRow label={terms.embouchure} value={`Level ${embouchure}`} subtext={`+${((embouchure - 1) * 2).toFixed(0)}% Crit Chance`} color="text-purple-400" />
                                </div>

                                {/* Combat Stats */}
                                <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                    <SectionHeader title="Combat Stats" icon="⚔️" />
                                    <StatRow
                                        label="Base Damage"
                                        value={Math.floor(basicAttackDamage || damage || 0)}
                                        subtext={weaponMeldTier > 0 ? `(×${WEAPON_TIER_DAMAGE_MULTIPLIERS[weaponMeldTier]} weapon tier multiplier)` : undefined}
                                    />
                                    {weaponMeldTier > 0 && weaponMeldType && (
                                        <StatRow
                                            label="Weapon Meld"
                                            value={WEAPON_MELD_TYPE_INFO[weaponMeldType].name}
                                            subtext={`${WEAPON_MELD_TYPE_INFO[weaponMeldType].primaryStat}: +${typeof weaponMeldBonus.primary === 'number' && weaponMeldBonus.primary < 1 ? (weaponMeldBonus.primary * 100).toFixed(0) + '%' : weaponMeldBonus.primary}`}
                                            color="text-red-400"
                                        />
                                    )}
                                    <StatRow label="Base Health" value={Math.floor(maxHealth)} color="text-red-400" />
                                    <StatRow label="Base Speed" value={`${speed.toFixed(2)} ft/s`} color="text-cyan-400" />
                                    <StatRow label="Base Crit Chance" value={`${((critChance || 0) * 100).toFixed(1)}%`} color="text-orange-400" />
                                    {superCritChance > 0 && (
                                        <StatRow label="Super-Crit Chance" value={`${(superCritChance * 100).toFixed(1)}%`} subtext="Spillover from >100% crit" color="text-red-400" />
                                    )}
                                    <StatRow label="Crit Factor" value={`${totalCritFactor.toFixed(2)}x`} subtext={`Base 1.5x + bonuses`} color="text-orange-400" />
                                    <StatRow label="Base Defense" value={`${(totalDefense * 100).toFixed(0)}%`} color="text-green-400" />
                                    <StatRow label="Impact" value={(impact + (abilityUpgradeStats.impactBonus || 0) + meldBonus.impact).toFixed(1)} subtext={`+${((impact + (abilityUpgradeStats.impactBonus || 0) + meldBonus.impact) * 5).toFixed(0)}% damage, ${(impact + (abilityUpgradeStats.impactBonus || 0) + meldBonus.impact).toFixed(1)}ft knockback`} color="text-yellow-400" />
                                    {meldBonus.selfHeal > 0 && (
                                        <StatRow label="Self-Healing" value={`${(meldBonus.selfHeal * 100).toFixed(2)}% HP/s`} subtext="Max HP regen per second" color="text-emerald-400" />
                                    )}
                                    {meldBonus.lifesteal > 0 && (
                                        <StatRow label="LifeSteal" value={`${(meldBonus.lifesteal * 100).toFixed(2)}%`} subtext="Damage dealt healed" color="text-rose-400" />
                                    )}
                                    {meldBonus.critChance > 0 && (
                                        <StatRow label="Meld Crit Bonus" value={`+${(meldBonus.critChance * 100).toFixed(1)}%`} subtext="From case meld" color="text-orange-400" />
                                    )}
                                </div>

                                {/* Abilities */}
                                <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                    <SectionHeader title="Abilities" icon="✨" />
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center">
                                            <span className="text-slate-300 font-medium">{abilityName}</span>
                                            <span className="text-xs text-blue-400">Active</span>
                                        </div>
                                        <div className="text-xs text-slate-500 space-y-1">
                                            {equippedLigature && ligatureStats && (
                                                <p>+{(ligatureStats.longToneBonus * ligatureSlotMultiplier).toFixed(2)}s {abilityName} Duration (Ligature)</p>
                                            )}
                                            {abilityUpgradeStats.durationBonus > 0 && (
                                                <p>+{abilityUpgradeStats.durationBonus.toFixed(1)}s {abilityName} Duration (Upgrades)</p>
                                            )}
                                            {!equippedLigature && abilityUpgradeStats.durationBonus === 0 && (
                                                <p className="text-slate-600">No duration bonuses</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Ability Upgrades */}
                                {isUpgradesUnlocked && abilityUpgrades.currentLevel > 0 && (
                                    <div className="p-4 rounded-lg bg-slate-800/30 border border-yellow-600/30">
                                        <SectionHeader title={`${abilityName} Upgrades`} icon="⬆️" />
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center">
                                                <span className="text-slate-300">Upgrade Level</span>
                                                <span className="text-yellow-400 font-bold">{abilityUpgrades.currentLevel} / {abilityUpgrades.currentLevel <= 10 ? 10 : 25}</span>
                                            </div>
                                            {abilityUpgrades.chosenPath && (
                                                <div className="flex justify-between items-center">
                                                    <span className="text-slate-300">Path</span>
                                                    <span className={`
                                                    ${abilityUpgrades.chosenPath === 'crits' ? 'text-orange-400' : ''}
                                                    ${abilityUpgrades.chosenPath === 'brute_force' ? 'text-red-400' : ''}
                                                    ${abilityUpgrades.chosenPath === 'poison' ? 'text-green-400' : ''}
                                                `}>
                                                        {abilityUpgrades.chosenPath === 'crits' ? 'Critical Hits' :
                                                            abilityUpgrades.chosenPath === 'brute_force' ? 'Brute Force' : 'Poison'}
                                                    </span>
                                                </div>
                                            )}
                                            {/* Upgrade Stats */}
                                            <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-1 text-xs">
                                                {abilityUpgradeStats.critChance > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Ability Crit Chance</span>
                                                        <span className="text-orange-400">+{(abilityUpgradeStats.critChance * 100).toFixed(1)}%</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.critFactor > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Ability Crit Factor</span>
                                                        <span className="text-orange-400">{abilityUpgradeStats.critFactor.toFixed(2)}x</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.baseDamageBonus > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Base Damage Bonus</span>
                                                        <span className="text-red-400">+{(abilityUpgradeStats.baseDamageBonus * 100).toFixed(0)}%</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.damageMultiplier > 1 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Damage Multiplier</span>
                                                        <span className="text-yellow-400">×{abilityUpgradeStats.damageMultiplier.toFixed(2)}</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.rangeBonus > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Range Bonus</span>
                                                        <span className="text-cyan-400">+{abilityUpgradeStats.rangeBonus.toFixed(1)} ft</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.impactBonus > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Impact Bonus</span>
                                                        <span className="text-yellow-400">+{abilityUpgradeStats.impactBonus.toFixed(1)}</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.durationBonus > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Duration Bonus</span>
                                                        <span className="text-green-400">+{abilityUpgradeStats.durationBonus.toFixed(1)}s</span>
                                                    </div>
                                                )}
                                                {abilityUpgradeStats.cooldownReduction > 0 && (
                                                    <div className="flex justify-between">
                                                        <span className="text-slate-400">Cooldown Reduction</span>
                                                        <span className="text-blue-400">-{(abilityUpgradeStats.cooldownReduction * 100).toFixed(0)}%</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {isUpgradesUnlocked && abilityUpgrades.currentLevel === 0 && (
                                    <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                        <SectionHeader title={`${abilityName} Upgrades`} icon="⬆️" />
                                        <p className="text-sm text-slate-400">No upgrades purchased yet. Visit the crafting menu to upgrade your ability!</p>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Equipment */}
                            {renderPhase >= 2 && (
                                <div>
                                    <SectionHeader title="Active Equipment" icon="🛡️" />
                                    <div className="space-y-4">
                                        {/* Accessories */}
                                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                            <SectionHeader title="Accessories" icon="🎒" />

                                            {/* Reed */}
                                            <div className="mb-3">
                                                <p className="text-xs text-slate-500 uppercase mb-1">{terms.reed}</p>
                                                {equippedReed ? (
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className={`font-medium ${getRarityColor(getReedData(equippedReed).rarity)}`}>
                                                                {getReedData(equippedReed).name}
                                                            </p>
                                                            {reedSlot >= 0 && (
                                                                <p className="text-xs text-slate-500">Slot {reedSlot + 1} ({Math.round((reedSlotMultiplier - 1) * 100)}% bonus)</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EmptySlot text={`No ${terms.reed.toLowerCase()} equipped`} />
                                                )}
                                            </div>

                                            {/* Ligature */}
                                            <div className="mb-3">
                                                <p className="text-xs text-slate-500 uppercase mb-1">{terms.ligature}</p>
                                                {equippedLigature ? (
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className={`font-medium ${getRarityColor(getLigatureData(equippedLigature.id).rarity)}`}>
                                                                {getLigatureData(equippedLigature.id).name} (Lv {equippedLigature.level})
                                                            </p>
                                                            {ligatureSlot >= 0 && (
                                                                <p className="text-xs text-slate-500">Slot {ligatureSlot + 1} ({Math.round((ligatureSlotMultiplier - 1) * 100)}% bonus)</p>
                                                            )}
                                                            {ligatureStats && (
                                                                <p className="text-xs text-purple-400">
                                                                    +{(ligatureStats.tubaDamageBonus * ligatureSlotMultiplier * 100).toFixed(0)}% vs Tubas
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EmptySlot text={`No ${terms.ligature.toLowerCase()} equipped`} />
                                                )}
                                            </div>

                                            {/* Mouthpiece */}
                                            <div className="mb-3">
                                                <p className="text-xs text-slate-500 uppercase mb-1">{playerClass === 'viola' ? 'Rosin' : 'Mouthpiece'}</p>
                                                {equippedMouthpiece ? (
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className={`font-medium ${getRarityColor(getMouthpieceData(equippedMouthpiece.id).rarity)}`}>
                                                                {playerClass === 'viola'
                                                                    ? getMouthpieceData(equippedMouthpiece.id).violaName
                                                                    : getMouthpieceData(equippedMouthpiece.id).name} (Lv {equippedMouthpiece.level})
                                                            </p>
                                                            {mouthpieceSlot >= 0 && (
                                                                <p className="text-xs text-slate-500">Slot {mouthpieceSlot + 1} ({Math.round((mouthpieceSlotMultiplier - 1) * 100)}% bonus)</p>
                                                            )}
                                                            {mouthpieceStats && mouthpieceStats.critFactor > 0 && (
                                                                <p className="text-xs text-orange-400">
                                                                    +{(mouthpieceStats.critFactor * mouthpieceSlotMultiplier).toFixed(2)}x Crit Factor
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EmptySlot text={`No ${playerClass === 'viola' ? 'rosin' : 'mouthpiece'} equipped`} />
                                                )}
                                            </div>

                                            {/* Case */}
                                            <div>
                                                <p className="text-xs text-slate-500 uppercase mb-1">Case</p>
                                                {equippedCase ? (
                                                    <div className="flex justify-between items-start">
                                                        <div>
                                                            <p className={`font-medium ${getRarityColor(getCaseData(equippedCase.id).rarity)}`}>
                                                                {getCaseData(equippedCase.id).name} (Lv {equippedCase.level})
                                                            </p>
                                                            {caseSlot >= 0 && (
                                                                <p className="text-xs text-slate-500">Slot {caseSlot + 1} ({Math.round((caseSlotMultiplier - 1) * 100)}% bonus)</p>
                                                            )}
                                                            {caseStats && (
                                                                <>
                                                                    <p className="text-xs text-red-400">
                                                                        ×{caseStats.healthMultiplier.toFixed(2)} Health
                                                                    </p>
                                                                    {caseStats.speedBonus > 0 && (
                                                                        <p className="text-xs text-cyan-400">
                                                                            +{caseStats.speedBonus.toFixed(2)} ft/s
                                                                        </p>
                                                                    )}
                                                                </>
                                                            )}
                                                            {equippedCase.meldType && equippedCase.meldTier && equippedCase.meldTier >= 1 && (
                                                                <p className="text-xs text-amber-400">
                                                                    {MELD_TYPE_INFO[equippedCase.meldType].emoji} {MELD_TYPE_INFO[equippedCase.meldType].name} Meld (Tier {equippedCase.meldTier})
                                                                    {equippedCase.meldTier >= 2 && (() => {
                                                                        const ms = getMeldStats(equippedCase.meldType!, equippedCase.meldTier!);
                                                                        if (ms.defense > 0) return ` (+${(ms.defense * 100).toFixed(1)}% Def)`;
                                                                        if (ms.selfHeal > 0) return ` (+${(ms.selfHeal * 100).toFixed(2)}% HP/s)`;
                                                                        if (ms.critChance > 0) return ` (+${(ms.critChance * 100).toFixed(1)}% Crit)`;
                                                                        if (ms.impact > 0) return ` (+${ms.impact} Impact)`;
                                                                        if (ms.lifesteal > 0) return ` (+${(ms.lifesteal * 100).toFixed(2)}% LS)`;
                                                                        return '';
                                                                    })()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <EmptySlot text="No case equipped" />
                                                )}
                                            </div>
                                        </div>

                                        {/* Enchantments */}
                                        <div className="p-4 rounded-lg bg-slate-800/30 border border-slate-700">
                                            <SectionHeader title="Enchantments" icon="✨" />
                                            <div className="space-y-3">
                                                {(['common', 'infused', 'arcane'] as const).map((tier) => {
                                                    const enchant = equippedEnchantments[tier];
                                                    const requiredLevel = ENCHANTMENT_SLOT_LEVELS[tier];
                                                    if (!enchant) {
                                                        return (
                                                            <div key={tier} className="flex justify-between items-center">
                                                                <span className="text-xs text-slate-500 uppercase">{tier}</span>
                                                                {level >= requiredLevel ? (
                                                                    <span className="text-xs text-slate-600">Empty</span>
                                                                ) : (
                                                                    <span className="text-xs text-red-500">Lv {requiredLevel} Required</span>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    const data = getEnchantmentData(enchant.id, tier);
                                                    return (
                                                        <div key={tier} className="border-b border-slate-700/50 last:border-0 pb-2 last:pb-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className="text-xs text-slate-500 uppercase">{tier}</span>
                                                                <span className={`text-sm font-medium ${getRarityColor(data.rarity)}`}>
                                                                    {tier === 'common' ? '✨' : tier === 'infused' ? '🔮' : '🌟'} {data.name}
                                                                </span>
                                                            </div>
                                                            {/* Enchantment Effects */}
                                                            <div className="text-xs text-slate-400 pl-2 border-l-2 border-slate-600">
                                                                {data.critFactorBonus && (
                                                                    <div className="text-orange-400">+{data.critFactorBonus}x Crit Factor</div>
                                                                )}
                                                                {data.defenseBonus && (
                                                                    <div className="text-green-400">+{(data.defenseBonus * 100).toFixed(0)}% Defense</div>
                                                                )}
                                                                {data.trumpetDamageMultiplier && (
                                                                    <div className="text-orange-400">{data.trumpetDamageMultiplier}x Damage vs Trumpets</div>
                                                                )}
                                                                {data.euphoniumDefenseBonus && (
                                                                    <div className="text-green-400">+{(data.euphoniumDefenseBonus * 100).toFixed(0)}% Defense vs Euphoniums</div>
                                                                )}
                                                                {data.hornRetaliationDamage && (
                                                                    <div className="text-red-400">{(data.hornRetaliationDamage * 100).toFixed(0)}% Retaliation vs Horns</div>
                                                                )}
                                                                {data.procAttackCount && (
                                                                    <div className="text-blue-400">Every {data.procAttackCount} attacks: Heal {(data.healPercent! * 100).toFixed(0)}% HP</div>
                                                                )}
                                                                {data.permanentSpeedBonus && (
                                                                    <div className="text-cyan-400">+{(data.permanentSpeedBonus * 100).toFixed(0)}% Permanent Speed</div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                {renderPhase >= 2 && (
                    <div className="px-6 py-4 border-t border-slate-700 bg-slate-800/30 flex-shrink-0">
                        <div className="flex justify-between items-center">
                            <p className="text-xs text-slate-500">Press <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">E</kbd> or <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300 font-mono">ESC</kbd> to close</p>
                            <button
                                onClick={handleClose}
                                className="py-2 px-6 bg-yellow-600/20 border border-yellow-600/40 text-yellow-500 rounded hover:bg-yellow-600/30 transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StatsScreen;
