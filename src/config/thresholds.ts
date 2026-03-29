/**
 * Konfigurasjon for alarmgrenser i drivhuset
 * 
 * Rediger disse verdiene for å justere når varsler skal vises
 * på dashboardet. Verdiene brukes til å vise visuelle advarsler
 * når målinger er utenfor det anbefalte området.
 */

export const thresholds = {
  /**
   * Temperaturgrenser (°C)
   * Alarm trigges når temperaturen er UNDER min eller OVER max
   */
  temperature: {
    min: 12,  // Minimum anbefalt temperatur i °C
    max: 28,  // Maksimum anbefalt temperatur i °C
  },

  /**
   * Luftfuktighetsgrenser (%)
   * Alarm trigges når luftfuktigheten er UNDER min eller OVER max
   */
  humidity: {
    min: 50,  // Minimum anbefalt luftfuktighet i %
    max: 80,  // Maksimum anbefalt luftfuktighet i %
  },
} as const;

/**
 * Varslingsmeldinger
 * Disse brukes i UI når grenseverdier overskrides
 */
export const warningMessages = {
  temperature: {
    tooLow: (temp: number, min: number) => 
      `Temperaturen er ${temp.toFixed(1)}°C, som er under det anbefalte minimumet på ${min}°C. Dette kan skade plantene.`,
    tooHigh: (temp: number, max: number) => 
      `Temperaturen er ${temp.toFixed(1)}°C, som er over det anbefalte maksimum på ${max}°C. Dette kan stresse plantene.`,
  },
  humidity: {
    tooLow: (humidity: number, min: number) => 
      `Luftfuktigheten er ${humidity.toFixed(1)}%, som er under det anbefalte minimumet på ${min}%. Plantene kan tørke ut.`,
    tooHigh: (humidity: number, max: number) => 
      `Luftfuktigheten er ${humidity.toFixed(1)}%, som er over det anbefalte maksimum på ${max}%. Dette kan føre til mugg og sykdom.`,
  },
} as const;
