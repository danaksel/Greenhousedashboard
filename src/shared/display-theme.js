export const displayTheme = {
  dark: {
    labelColor: "#ffffff",
    labelOpacity: 0.8,
    unitColor: "#b3bea3",
    defaultValueColor: "#d3deca",
    temperatureValueColor: "#d0dec8",
    normalTemperatureColor: "#d0dec8",
    coldTemperatureColor: "#5190a1",
    warmTemperatureColor: "#d28c31",
    hotTemperatureColor: "#c44747",
    coldPulseColor: "#8fd6e2",
    hotPulseColor: "#ff6363",
    warningPulseColor: "#ffffff",
    coldTickerColor: "#5190a1",
    hotTickerColor: "#c44747",
    mutedColor: "#8d9d7e",
    symbolColor: "#8d9d7e",
    graphPanelBg: "#25341d",
    graphPanelBorder: "#4e6240",
    logoColor: "#e8ede3",
    doorIconColor: "",
    windowIconColor: "",
    fanIconColor: "",
  },
  light: {
    labelColor: "#78716c",
    labelOpacity: 1,
    unitColor: "#78716c",
    defaultValueColor: "#4d5d3e",
    temperatureValueColor: "#495f3a",
    normalTemperatureColor: "#495f3a",
    coldTemperatureColor: "#70abb6",
    warmTemperatureColor: "#d28c31",
    hotTemperatureColor: "#c44747",
    coldPulseColor: "#9bc7cf",
    hotPulseColor: "#ff6363",
    warningPulseColor: "#8d9d7e",
    coldTickerColor: "#70abb6",
    hotTickerColor: "#c44747",
    mutedColor: "#78716c",
    symbolColor: "#78716c",
    graphPanelBg: "#ffffff",
    graphPanelBorder: "#d8ded1",
    logoColor: "#2d3a21",
    doorIconColor: "",
    windowIconColor: "",
    fanIconColor: "",
  },
};

export function getDefaultDisplayThemeForSlot(slot) {
  const darkSlotTheme = getDefaultDisplaySlotTheme(slot);
  return {
    dark: {
      ...displayTheme.dark,
      temperatureValueColor: darkSlotTheme.temperatureValueColor,
    },
    light: { ...displayTheme.light },
  };
}

export function getResolvedDisplayTheme(themeConfig, slot) {
  const fallback = slot ? getDefaultDisplayThemeForSlot(slot) : displayTheme;
  return {
    dark: sanitizeDisplayThemeMode({ ...fallback.dark, ...(themeConfig?.dark || {}) }, fallback.dark),
    light: sanitizeDisplayThemeMode({ ...fallback.light, ...(themeConfig?.light || {}) }, fallback.light),
  };
}

export function getTemperatureValueTheme(value, darkMode = false, hasWarning = false, themeConfig, slot) {
  const resolvedTheme = getResolvedDisplayTheme(themeConfig, slot);
  const theme = darkMode ? resolvedTheme.dark : resolvedTheme.light;
  let color = theme.defaultValueColor;
  let pulseColor = hasWarning ? theme.warningPulseColor : "";
  let shouldPulse = hasWarning;

  if (value !== null && value !== undefined && Number.isFinite(Number(value))) {
    const numericValue = Number(value);
    if (numericValue < 12) {
      color = theme.coldTemperatureColor;
      pulseColor = theme.coldPulseColor;
      shouldPulse = true;
    } else if (numericValue < 23) {
      color = theme.normalTemperatureColor;
      pulseColor = "";
      shouldPulse = false;
    } else if (numericValue <= 28) {
      color = theme.warmTemperatureColor;
      pulseColor = "";
      shouldPulse = false;
    } else {
      color = theme.hotTemperatureColor;
      pulseColor = theme.hotPulseColor;
      shouldPulse = true;
    }
  }

  return { color, pulseColor, shouldPulse };
}

export function getDisplaySlotTheme(slot, darkThemeConfig) {
  const theme = sanitizeDisplayThemeMode({ ...getDefaultDisplaySlotTheme(slot), ...(darkThemeConfig || {}) }, displayTheme.dark);
  const temperatureValueColor = getSlotTemperatureColor(slot, theme);
  return {
    ...theme,
    temperatureValueColor,
    humidityValueColor:
      darkThemeConfig && Object.prototype.hasOwnProperty.call(darkThemeConfig, "defaultValueColor") && !Object.prototype.hasOwnProperty.call(darkThemeConfig, "humidityValueColor")
        ? theme.defaultValueColor
        : theme.humidityValueColor,
  };
}

function sanitizeDisplayThemeMode(theme, fallback = displayTheme.dark) {
  const temperatureColors = [
    theme.temperatureValueColor,
    theme.normalTemperatureColor,
    theme.coldTemperatureColor,
    theme.warmTemperatureColor,
    theme.hotTemperatureColor,
  ].filter(Boolean);
  const inheritedTemperatureColor = temperatureColors.some(
    (color) => sameHexColor(theme.symbolColor, color) || sameHexColor(theme.auxColor, color)
  );

  if (!inheritedTemperatureColor) return theme;

  return {
    ...theme,
    symbolColor: fallback.symbolColor || displayTheme.dark.symbolColor,
    auxColor: fallback.symbolColor || fallback.auxColor || displayTheme.dark.symbolColor,
  };
}

function sameHexColor(left, right) {
  return typeof left === "string" && typeof right === "string" && left.toLowerCase() === right.toLowerCase();
}

function getDefaultDisplaySlotTheme(slot) {
  const theme = displayTheme.dark;
  const temperatureValueColor = getSlotTemperatureColor(slot, theme);

  return {
    labelColor: theme.labelColor,
    labelOpacity: theme.labelOpacity,
    temperatureValueColor,
    humidityValueColor: theme.defaultValueColor,
    unitColor: theme.unitColor,
    symbolColor: theme.symbolColor,
    auxColor: theme.symbolColor,
    coldTickerColor: theme.coldTickerColor,
    hotTickerColor: theme.hotTickerColor,
    graphPanelBg: theme.graphPanelBg,
    graphPanelBorder: theme.graphPanelBorder,
  };
}

function getSlotTemperatureColor(slot, theme) {
  return slot === "cold" || slot === "coldNight" || slot === "rain"
    ? theme.coldTemperatureColor
    : slot === "warm"
      ? theme.warmTemperatureColor
      : slot === "hot"
        ? theme.hotTemperatureColor
        : theme.normalTemperatureColor;
}
