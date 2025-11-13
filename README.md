# unocss-transformer-template

<!-- @unocss-ignore -->

UnoCSS transformer for creating reusable CSS templates, variants and components with `@template-content`, `@template-variant`, `@template-component` directives and `@for` loops.

## Install

```bash
npm i -D unocss-transformer-template
```

```ts
// uno.config.ts
import { defineConfig } from 'unocss'
import transformerTemplate from 'unocss-transformer-template'

export default defineConfig({
  // ...
  transformers: [
    transformerTemplate(),
  ],
})
```

## Usage

### `@template-content`

Defines a reusable content template with parameters.

```css
@template-content accent (color) {
  --primary-color: var(--$[color]-primary);
  --secondary-color: var(--$[color]-secondary);
}
```

This template can be referenced by other directives and will be transformed to an empty string (it's a definition only).

### `@template-variant`

Creates CSS selectors with dynamic parameters using template interpolation.

```css
@template-variant accent (color) (&[data-color='accent:$[color]'],
  html:not(.mobile) &[data-color='hocus:accent:$[color]']:hover,
  html.mobile &[data-color='hocus:accent:$[color]']:active,
  &[data-color='hocus:accent:$[color]']:focus-visible);
```

When combined with `@template-content`, generates complete CSS rules:

```css
@template-variant accent(pink) {
  @template-content accent(pink);
}
```

Will be transformed to:

```css
&[data-color='accent:pink'],
  html:not(.mobile) &[data-color='hocus:accent:pink']:hover,
  html.mobile &[data-color='hocus:accent:pink']:active,
  &[data-color='hocus:accent:pink']:focus-visible{
  --primary-color: var(--pink-primary);
  --secondary-color: var(--pink-secondary);
}
```

### `@template-component`

Combines a variant with content in a single directive for concise component definitions.

```css
@template-component accent(yellow);
```

Will be transformed to:

```css
&[data-color='accent:yellow'],
  html:not(.mobile) &[data-color='hocus:accent:yellow']:hover,
  html.mobile &[data-color='hocus:accent:yellow']:active,
  &[data-color='hocus:accent:yellow']:focus-visible {--primary-color: var(--yellow-primary);
  --secondary-color: var(--yellow-secondary);}
```

### `@for` Loops

Generates multiple variants dynamically by iterating over arrays.

```css
@for (color in [red, green, blue]) {
  /* Accent: $[color] */
  @template-component accent($[color]);
}
```

Will be transformed to:

```css
/* Accent: blue */
  &[data-color='accent:blue'],
  html:not(.mobile) &[data-color='hocus:accent:blue']:hover,
  html.mobile &[data-color='hocus:accent:blue']:active,
  &[data-color='hocus:accent:blue']:focus-visible {--primary-color: var(--blue-primary);
  --secondary-color: var(--blue-secondary);}
/* Accent: green */
  &[data-color='accent:green'],
  html:not(.mobile) &[data-color='hocus:accent:green']:hover,
  html.mobile &[data-color='hocus:accent:green']:active,
  &[data-color='hocus:accent:green']:focus-visible {--primary-color: var(--green-primary);
  --secondary-color: var(--green-secondary);}
/* Accent: red */
  &[data-color='accent:red'],
  html:not(.mobile) &[data-color='hocus:accent:red']:hover,
  html.mobile &[data-color='hocus:accent:red']:active,
  &[data-color='hocus:accent:red']:focus-visible {--primary-color: var(--red-primary);
  --secondary-color: var(--red-secondary);}
```

### Nested Templates and Variants

Templates can reference other templates for composition:

```css
@template-content base-styles (theme) {
  background: var(--$[theme]-bg);
  color: var(--$[theme]-text);
}

@template-variant glass-effect {
  @template-content base-styles(glass);
  backdrop-filter: blur(10px);
}
```

## Configuration Options

```ts
transformerTemplate({
  // Do not use a separate scope for each block of code.
  // Default: false
  weekScope: false,
  
  // Log syntax errors to console
  // Default: false
  showErrors: true,
})
```

### weekScope

When set to `false` (default), each block of code gets its own isolated scope. When set to `true`, all definitions share the same scope.

### showErrors

When `true`, syntax errors in your template directives will be logged to the console with detailed location information and code frames.

## License

MIT License &copy; 2025 [Italo Almeida](https://github.com/italoalmeida0)
