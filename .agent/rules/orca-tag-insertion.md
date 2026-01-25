# Orca Tag & Property Insertion Best Practices

## Context
When developing plugins that insert tags (`#Tag`) into blocks and assign properties to them (e.g., Status, Multi-select options), you must follow specific protocols to ensure data integrity, especially for **Multi-select (TextChoices)** properties.

## Core APIs

### `core.editor.insertTag`
Used to insert a tag block as a child of the current block (or specified location).

```typescript
await orca.commands.invokeEditorCommand(
  "core.editor.insertTag",
  null,          // cursor (optional)
  blockId,       // parent block ID
  tagName,       // Tag name (e.g., "Status")
  properties     // Array of PropertyDefault objects
);
```

## Critical Rule: Multi-select (TextChoices) Handling

For properties of type `PropType.TextChoices` (Multi-select/Select), simply passing the `value` is **NOT** sufficient if the option does not already exist in the tag's schema.

**You must ensure the schema knows about the option values.**

### Correct Implementation Pattern

When constructing the `properties` array for `insertTag`:

1.  **Value Format**: Pass the selected values as an **Array of strings** (e.g., `["OptionA", "OptionB"]`), even if it's a single selection.
2.  **Schema Definition (`typeArgs`)**: You **MUST** populate `typeArgs.choices` with the options you are assigning. This tells Orca to register these options as valid choices for this property on this tag.

```typescript
{
  name: "MyMultiSelect",
  type: PropType.TextChoices, // 3
  value: ["Option A", "Option B"], // Pass as Array!
  typeArgs: {
    // CRITICAL: Define these values as valid choices
    choices: [
      { n: "Option A", c: "" },
      { n: "Option B", c: "" }
    ],
    subType: "multi"
  },
  pos: 0
}
```

### Why?
If you only provide `value` without updating `typeArgs.choices`, Orca's backend may reject the value or fail to display it because it considers the value "invalid" according to the existing schema (which might be empty or missing those specific options).

## General Property Structure

```typescript
interface PropertyDefault {
  name: string;
  value: any;        // String, Number, Boolean, or String[] for TextChoices
  type: number;      // PropType enum
  typeArgs?: any;    // Extra metadata (choices, subType, etc.)
}
```
