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

export function bindCheckbox(box, onChange) {
  if (!box) return;
  box.addEventListener("change", () => onChange(box.checked));
}
