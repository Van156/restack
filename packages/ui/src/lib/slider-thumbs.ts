type SliderValue = number | readonly number[] | undefined;

/**
 * Number of thumbs a slider renders, derived from the shape of its value:
 * an array yields one thumb per entry (an empty array yields none, matching Base UI's
 * range mode); a scalar or absent value yields one.
 */
function getSliderThumbCount(value: SliderValue, defaultValue: SliderValue): number {
  const source = value !== undefined ? value : defaultValue;
  return Array.isArray(source) ? source.length : 1;
}

export { getSliderThumbCount };
