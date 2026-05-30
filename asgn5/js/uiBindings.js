/**
 * @file Generic DOM helpers — bind range sliders and checkboxes to scene callbacks.
 */

/** Bind a range slider; calls onChange(value) and updates label via format(value). */
export function bindRangeSlider(slider, label, { onChange, format }) {
  if (!slider) return null;
  const update = () => {
    const value = parseFloat(slider.value);
    onChange(value);
    if (label) label.textContent = format(value);
  };
  slider.addEventListener("input", update);
  update();
  return update;
}

/** Update slider + label without firing onChange (e.g. keyboard drove the same value). */
export function setRangeSliderValue(slider, label, value, format) {
  if (!slider) return;
  slider.value = String(value);
  if (label) label.textContent = format(value);
}

/** Bind a checkbox to onChange(checked). */
export function bindCheckbox(checkbox, onChange) {
  if (!checkbox) return;
  checkbox.addEventListener("change", () => onChange(checkbox.checked));
}
