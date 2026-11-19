// Exchange rates from TND (Tunisian Dinar): units of each currency for 1 TND.
// These rates are examples and should be updated with real rates from an API in production
const CONVERSION_RATES: { [key: string]: number } = {
  TND: 1.0,    // Tunisian Dinar (base currency)
  USD: 0.32,   // US Dollar
  EUR: 0.29,   // Euro
  GBP: 0.25,   // British Pound
  JPY: 42.53,  // Japanese Yen
};

// Currency symbols for formatting
const CURRENCY_SYMBOLS: { [key: string]: string } = {
  TND: "DT",
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
};

// Get list of available currencies
export const getAvailableCurrencies = (): { code: string; name: string; symbol: string }[] => [
  { code: "TND", name: "Tunisian Dinar", symbol: "DT" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥" },
];

/**
 * Convert a price from TND to another currency
 * @param price Price in TND (can be a string like "15.99 DT" or a number)
 * @param targetCurrency Currency code to convert to
 * @returns Converted price as a number
 */
export const convertPrice = (price: string | number, targetCurrency = "TND"): number => {
  // If price is a string, extract the numeric value
  let numericPrice: number;
  if (typeof price === "string") {
    // Extract numbers from the string (e.g., "15.99 DT" -> 15.99)
    const match = price.match(/\d+(\.\d+)?/);
    numericPrice = match ? parseFloat(match[0]) : 0;
  } else {
    numericPrice = price;
  }

  // Convert from TND to the target currency: 1 TND = rate units (e.g. 10 TND -> 3.20 USD)
  const conversionRate = CONVERSION_RATES[targetCurrency] || 1;
  return numericPrice * conversionRate;
};

/**
 * Format a price in the specified currency
 * @param price Price in TND (can be a string like "15.99 DT" or a number)
 * @param currency Currency code to format in
 * @returns Formatted price string (e.g., "$5.12")
 */
export const formatPrice = (price: string | number, currency = "TND"): string => {
  const convertedPrice = convertPrice(price, currency);
  const symbol = CURRENCY_SYMBOLS[currency] || "";
  
  // Format the price appropriately based on currency
  if (currency === "TND") {
    return `${convertedPrice.toFixed(2)} ${symbol}`;
  } else if (currency === "JPY") {
    return `${symbol}${Math.round(convertedPrice)}`;
  } else {
    return `${symbol}${convertedPrice.toFixed(2)}`;
  }
}; 