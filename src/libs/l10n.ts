type Translations = { [locale: string]: { [key: string]: string } };

let _locale = "en";
let _translations: Translations = {};

export function setupL10N(locale: string, builtinTranslations: Translations) {
  _locale = locale;
  _translations = builtinTranslations;
}

export function t(
  key: string,
  args?: { [key: string]: string },
  locale?: string
) {
  let template = _translations[locale ?? _locale]?.[key];
  
  if (template === undefined) {
    // Fallback: If translation is missing, strip the prefix if there's a dot.
    const firstDot = key.indexOf(".");
    template = firstDot !== -1 ? key.slice(firstDot + 1) : key;
  }

  if (args == null) return template;

  return Object.entries(args).reduce(
    (str, [name, val]) => str.replaceAll(`\${${name}}`, val),
    template
  );
}
