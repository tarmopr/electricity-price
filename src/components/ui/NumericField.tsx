'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
    clampNumber,
    evaluateDraft,
    formatNumber,
    parseNumericInput,
    roundPrecision,
    snapToStep,
} from '@/lib/numericInput';

interface NumericFieldProps {
    /** Last committed (valid) value */
    value: number;
    /** Called with each valid (clamped) value — live while typing, on blur and on step */
    onCommit: (value: number) => void;
    min: number;
    max?: number;
    step: number;
    /** Snap committed values to this increment on blur / step (e.g. 0.25 h = 15 min) */
    snapStep?: number;
    /** Accessible label for the text input */
    label: string;
    /** Unit shown after the field and in range hints, e.g. "kWh", "h" */
    unit: string;
    /** Notified when the draft becomes empty/unparseable (false) or valid again (true) */
    onValidityChange?: (valid: boolean) => void;
    /** Focus ring color variant */
    accent?: 'emerald' | 'yellow';
    /** Width class for the text input */
    inputWidthClass?: string;
}

const STEP_BUTTON =
    'flex items-center justify-center w-11 h-11 sm:w-8 sm:h-8 rounded-lg border border-zinc-700/80 bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700/60 hover:text-zinc-100 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none';

const INPUT_BASE =
    'bg-zinc-800/50 border text-zinc-200 text-base sm:text-sm rounded-lg px-3 h-11 sm:h-8 focus:outline-none focus:ring-1 text-center tabular-nums transition-colors';

const RING_EMERALD = 'focus:ring-emerald-500/50';
const RING_YELLOW = 'focus:ring-yellow-500/50';

/**
 * Mobile-friendly numeric input with − / + steppers.
 *
 * Keeps a draft string so the user can clear the field or type "12," without
 * the value being coerced; valid drafts are committed live, and the draft is
 * normalized to the committed value on blur.
 */
export default function NumericField({
    value,
    onCommit,
    min,
    max = Infinity,
    step,
    snapStep,
    label,
    unit,
    onValidityChange,
    accent = 'emerald',
    inputWidthClass = 'w-20',
}: NumericFieldProps) {
    const hintId = useId();
    const [draft, setDraft] = useState(() => formatNumber(value));
    const [focused, setFocused] = useState(false);
    const [prevValue, setPrevValue] = useState(value);
    const selectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (selectTimer.current !== null) clearTimeout(selectTimer.current);
    }, []);

    /** Clamp, then snap (re-clamping in case snapping crossed a bound). */
    function normalize(raw: number): number {
        const clamped = clampNumber(raw, min, max);
        return snapStep ? clampNumber(snapToStep(clamped, snapStep), min, max) : clamped;
    }

    // Sync external value changes (preset, stepper, parent reset) into the draft —
    // but never overwrite what the user is typing while focused.
    if (value !== prevValue) {
        setPrevValue(value);
        if (!focused) setDraft(formatNumber(value));
    }

    const evaluation = evaluateDraft(draft, min, max);
    const invalid = evaluation.value === null;
    const hint =
        evaluation.outOfRange === 'max'
            ? `max ${formatNumber(max)} ${unit}`
            : evaluation.outOfRange === 'min'
                ? `min ${formatNumber(min)} ${unit}`
                : null;

    function handleChange(next: string) {
        setDraft(next);
        const { value: committed } = evaluateDraft(next, min, max);
        onValidityChange?.(committed !== null);
        if (committed !== null && committed !== value) onCommit(committed);
    }

    function handleBlur() {
        setFocused(false);
        const parsed = parseNumericInput(draft);
        const next = parsed === null ? normalize(value) : normalize(parsed);
        setDraft(formatNumber(next));
        onValidityChange?.(true);
        if (next !== value) onCommit(next);
    }

    function stepBy(direction: 1 | -1) {
        const parsed = parseNumericInput(draft);
        const base = parsed === null ? value : clampNumber(parsed, min, max);
        const next = normalize(roundPrecision(base + direction * step));
        setDraft(formatNumber(next));
        onValidityChange?.(true);
        if (next !== value) onCommit(next);
    }

    const ring = accent === 'yellow' ? RING_YELLOW : RING_EMERALD;
    const borderClass = invalid || hint ? 'border-red-500/60' : 'border-zinc-700/80';

    return (
        <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5">
                <button
                    type="button"
                    onClick={() => stepBy(-1)}
                    disabled={value <= min}
                    aria-label={`Decrease ${label}`}
                    className={STEP_BUTTON}
                >
                    <Minus className="w-4 h-4" />
                </button>
                <input
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    value={draft}
                    onChange={(e) => handleChange(e.target.value)}
                    onFocus={(e) => {
                        setFocused(true);
                        const el = e.currentTarget;
                        el.select();
                        // iOS Safari ignores a synchronous select() in onFocus — repeat after the tap settles
                        if (selectTimer.current !== null) clearTimeout(selectTimer.current);
                        selectTimer.current = setTimeout(() => {
                            selectTimer.current = null;
                            if (document.activeElement === el) el.select();
                        }, 0);
                    }}
                    onBlur={handleBlur}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                    }}
                    aria-label={label}
                    aria-invalid={invalid || hint !== null}
                    aria-describedby={hint ? hintId : undefined}
                    className={`${INPUT_BASE} ${ring} ${borderClass} ${inputWidthClass}`}
                />
                <button
                    type="button"
                    onClick={() => stepBy(1)}
                    disabled={value >= max}
                    aria-label={`Increase ${label}`}
                    className={STEP_BUTTON}
                >
                    <Plus className="w-4 h-4" />
                </button>
                <span className="text-zinc-500 text-sm whitespace-nowrap ml-0.5">{unit}</span>
            </div>
            {hint && (
                <p id={hintId} role="status" className="text-xs text-red-400 pl-1">
                    {hint}
                </p>
            )}
        </div>
    );
}
