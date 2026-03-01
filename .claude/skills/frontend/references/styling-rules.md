# Styling Rules

## Colors

- NEVER use hardcoded hex colors in component code
- Use MUI palette paths: `'text.primary'`, `'text.secondary'`, `'grey.500'`, `'error.main'`, `'success.main'`
- Use `alpha()` for transparency: `alpha(theme.palette.text.primary, 0.5)`
- Theme has light/dark mode with custom palette defined in `theme.ts`

## Borders

- NEVER use rounded corners: `borderRadius: 0` (project-wide, set in theme `shape.borderRadius`)
- Use `borderColor: 'divider'` for borders
- For divider lines: `<Box sx={{ height: '1px', bgcolor: 'divider' }} />`

## Spacing

- Use MUI spacing scale via `sx`: `p: 2`, `gap: 1.5`, `mt: 3`
- Responsive: `p: { xs: 2, md: 4 }`

## Icons

- Always use `@phosphor-icons/react` with `weight="light"`
- ALWAYS use the `Icon` suffix: `TrashIcon`, `PlusIcon`, `CheckCircleIcon`
- Never use non-suffixed names (deprecated)
- Never use inline SVGs
- Use `color="currentColor"` and control color via parent `sx`
- Common sizes: 16 (inline), 20 (buttons), 24 (page headers), 48 (empty states)

## Typography

- Use MUI Typography with `variant` prop
- Common: `h4`, `h5`, `h6`, `body1`, `body2`, `caption`
- Use `color="text.secondary"` for secondary text
- Font: Inter (sans), Geist Mono (mono)

## Buttons

- `textTransform: 'none'` is set globally in theme
- Use `variant="contained"` for primary, default (outlined) for secondary
- Always include `disabled={isSubmitting}` on form submit buttons

## MUI sx patterns

```typescript
// Responsive display
sx={{ display: { xs: 'none', md: 'block' } }}

// Transitions
sx={{ transition: 'all 0.12s ease' }}

// Nested selectors
sx={{ '& .MuiSelect-select': { py: 0.75 } }}

// Conditional styles
sx={{ bgcolor: isDragOver ? 'primary.main' : 'grey.300' }}
```

## TextField (MUI v7)

Use `slotProps` instead of deprecated `InputProps`:

```typescript
<TextField
  fullWidth
  slotProps={{
    input: {
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon size={16} weight="light" color="currentColor" />
        </InputAdornment>
      ),
    },
  }}
/>
```

## Copy

- NEVER use em dashes anywhere in UI text. Use commas, periods, or rephrase.
