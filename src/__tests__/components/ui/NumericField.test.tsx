import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import NumericField from "@/components/ui/NumericField";

/** Controlled wrapper mirroring real usage (parent state updated on commit). */
function Harness({
  initial = 8,
  min = 0.25,
  max = 24,
  step = 0.25,
  snapStep,
  onCommit,
  onValidityChange,
}: {
  initial?: number;
  min?: number;
  max?: number;
  step?: number;
  snapStep?: number;
  onCommit?: (v: number) => void;
  onValidityChange?: (valid: boolean) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NumericField
        value={value}
        onCommit={(v) => {
          setValue(v);
          onCommit?.(v);
        }}
        min={min}
        max={max}
        step={step}
        snapStep={snapStep}
        label="Duration in hours"
        unit="h"
        onValidityChange={onValidityChange}
      />
      <span data-testid="committed">{value}</span>
      <button onClick={() => setValue(2)}>external</button>
    </>
  );
}

function getInput() {
  return screen.getByLabelText("Duration in hours") as HTMLInputElement;
}

describe("NumericField", () => {
  it("renders a text input with decimal keyboard, done key and no-zoom font size", () => {
    render(<Harness />);
    const input = getInput();
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("inputmode", "decimal");
    expect(input).toHaveAttribute("enterkeyhint", "done");
    expect(input.className).toContain("text-base");
    expect(input.className).toContain("sm:text-sm");
    expect(input).toHaveValue("8");
  });

  it("clearing the field does not reinsert a value while focused", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue("");
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId("committed")).toHaveTextContent("8");
  });

  it("typing digit by digit keeps the draft and commits live (no '18' bug)", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.change(input, { target: { value: "12" } });
    expect(input).toHaveValue("12");
    expect(onCommit).toHaveBeenLastCalledWith(12);
  });

  it('"12,5" commits 12.5', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} min={0} max={200} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12,5" } });
    expect(onCommit).toHaveBeenLastCalledWith(12.5);
    expect(input).toHaveValue("12,5");
  });

  it('"12," commits 12 and keeps the trailing comma in the draft', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} min={0} max={200} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12," } });
    expect(onCommit).toHaveBeenLastCalledWith(12);
    expect(input).toHaveValue("12,");
  });

  it("out of range commits the clamped value, shows a red hint and keeps the draft", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "30" } });
    expect(onCommit).toHaveBeenLastCalledWith(24);
    expect(input).toHaveValue("30");
    const hint = screen.getByText("max 24 h");
    expect(hint.className).toContain("text-red-400");
    expect(input).toHaveAttribute("aria-invalid", "true");
  });

  it("shows a min hint below the minimum", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "0" } });
    expect(screen.getByText("min 0.25 h")).toBeInTheDocument();
  });

  it("blur normalizes an empty draft to the last valid value", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("8");
  });

  it("blur normalizes an out-of-range draft to the clamped value and clears the hint", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("24");
    expect(screen.queryByText("max 24 h")).not.toBeInTheDocument();
  });

  it("blur normalizes '2,50' to '2.5'", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2,50" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("2.5");
  });

  it("Enter (keyboard Done) blurs and normalizes", () => {
    render(<Harness />);
    const input = getInput();
    input.focus();
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(input).toHaveValue("8");
  });

  it("steppers increment and decrement by step", () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Duration in hours" }));
    expect(onCommit).toHaveBeenLastCalledWith(8.25);
    expect(getInput()).toHaveValue("8.25");
    fireEvent.click(screen.getByRole("button", { name: "Decrease Duration in hours" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease Duration in hours" }));
    expect(getInput()).toHaveValue("7.75");
  });

  it("steppers clamp at bounds and disable at the limit", () => {
    render(<Harness initial={0.25} />);
    const dec = screen.getByRole("button", { name: "Decrease Duration in hours" });
    expect(dec).toBeDisabled();
    render(<Harness initial={23.9} />);
    const inc = screen.getAllByRole("button", { name: "Increase Duration in hours" })[1];
    fireEvent.click(inc);
    expect(screen.getAllByLabelText("Duration in hours")[1]).toHaveValue("24");
  });

  it("stepper buttons have ≥44px touch targets on mobile", () => {
    render(<Harness />);
    const inc = screen.getByRole("button", { name: "Increase Duration in hours" });
    expect(inc.className).toContain("w-11");
    expect(inc.className).toContain("h-11");
  });

  it("external value changes update the draft when not focused", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("external"));
    expect(getInput()).toHaveValue("2");
  });

  it("external value changes do not overwrite the draft while focused", () => {
    render(<Harness />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "5," } });
    fireEvent.click(screen.getByText("external"));
    expect(input).toHaveValue("5,");
  });

  it("reports draft validity changes", () => {
    const onValidityChange = vi.fn();
    render(<Harness onValidityChange={onValidityChange} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    expect(onValidityChange).toHaveBeenLastCalledWith(false);
    fireEvent.change(input, { target: { value: "3" } });
    expect(onValidityChange).toHaveBeenLastCalledWith(true);
  });

  it("selects all text on focus", () => {
    render(<Harness />);
    const input = getInput();
    const select = vi.spyOn(input, "select");
    fireEvent.focus(input);
    expect(select).toHaveBeenCalled();
  });

  it("re-selects after a tick for iOS Safari, and cleans up the timer on unmount", () => {
    vi.useFakeTimers();
    try {
      const { unmount } = render(<Harness />);
      const input = getInput();
      input.focus();
      const select = vi.spyOn(input, "select");
      fireEvent.focus(input);
      expect(select).toHaveBeenCalledTimes(1);
      vi.runOnlyPendingTimers();
      expect(select).toHaveBeenCalledTimes(2);

      fireEvent.focus(input);
      const clear = vi.spyOn(globalThis, "clearTimeout");
      unmount();
      expect(clear).toHaveBeenCalled();
      vi.runOnlyPendingTimers();
      expect(select).toHaveBeenCalledTimes(3); // pending re-select did not fire after unmount
      clear.mockRestore();
    } finally {
      vi.useRealTimers();
    }
  });

  it("snaps to snapStep on blur (duration → 15-minute increments)", () => {
    const onCommit = vi.fn();
    render(<Harness snapStep={0.25} onCommit={onCommit} />);
    const input = getInput();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2,3" } });
    expect(onCommit).toHaveBeenLastCalledWith(2.3); // live, unsnapped
    fireEvent.blur(input);
    expect(input).toHaveValue("2.25");
    expect(onCommit).toHaveBeenLastCalledWith(2.25);
  });

  it("snaps stepper results", () => {
    render(<Harness snapStep={0.25} initial={2.3} />);
    fireEvent.click(screen.getByRole("button", { name: "Increase Duration in hours" }));
    expect(getInput()).toHaveValue("2.5");
  });
});
