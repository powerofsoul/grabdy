# Frontend Patterns Reference

## Libraries

| Library               | Version | Purpose                        |
| --------------------- | ------- | ------------------------------ |
| React                 | 18.3    | UI framework                   |
| MUI                   | v7      | Component library              |
| TanStack React Query  | 5.51    | Data fetching, caching         |
| TanStack React Router | 1.43    | File-based routing             |
| ts-rest               | 3.53    | Type-safe API client           |
| react-hook-form       | 7.71    | Form management                |
| Zod                   | 4.0     | Schema validation              |
| sonner                | 2.0     | Toast notifications            |
| date-fns              | 4.1     | Date formatting                |
| GSAP                  | 3.12    | Animations (landing page only) |
| @phosphor-icons/react | 2.1     | Icons                          |

---

## API Calls (ts-rest + React Query)

The `api` client lives at `@/lib/api`. It uses cookie auth (`credentials: 'include'`).

### Fetching data

```typescript
const { data: bots = [] } = useQuery({
  queryKey: ['bots', selectedOrgId],
  queryFn: async () => {
    if (!selectedOrgId) return [];
    const res = await api.bots.list({ params: { orgId: selectedOrgId } });
    if (res.status === 200) return res.body.data;
    return [];
  },
  enabled: !!selectedOrgId,
});
```

### Mutations

```typescript
const deleteMutation = useMutation({
  mutationFn: async (target: Bot) => {
    const res = await api.bots.delete({
      params: { orgId: selectedOrgId, botId: target.id },
      body: {},
    });
    if (res.status !== 200) throw new Error('Failed to delete');
  },
  onSuccess: () => {
    toast.success('Bot deleted');
    queryClient.invalidateQueries({ queryKey: ['bots', selectedOrgId] });
  },
});
```

### Mutation meta (toast control)

The query client supports mutation meta for automatic toast messages:

```typescript
const mutation = useMutation({
  mutationFn: async () => { ... },
  meta: {
    successMessage: 'Settings saved',    // auto-shown on success
    errorMessage: 'Failed to save',      // overrides default error
    skipToast: true,                      // suppress all toasts
  },
});
```

### Multiple queries in a hook

```typescript
export function usePickerData(orgId: DbId<'Org'>) {
  const collectionsQuery = useQuery({
    queryKey: ['collections', orgId],
    queryFn: async () => {
      const res = await api.collections.list({ params: { orgId } });
      if (res.status === 200) return res.body.data;
      return [];
    },
  });

  const slackDsQuery = useQuery({
    queryKey: ['dataSources', orgId, 'byType', 'SLACK'],
    queryFn: async () => {
      const res = await api.dataSources.list({ params: { orgId }, query: { type: 'SLACK' } });
      if (res.status === 200) return res.body.data;
      return [];
    },
    enabled: hasActiveProvider('SLACK'),
  });

  const isLoading = collectionsQuery.isLoading || slackDsQuery.isLoading;
  return { collections: collectionsQuery.data ?? [], isLoading };
}
```

### Rules

- Check `res.status` and access `res.body.data`
- Use `enabled` for conditional queries
- Invalidate queries after mutations
- Never use raw `fetch()`, `useState` + `useEffect` for API calls
- All endpoints scoped to org: `/orgs/:orgId/...`

### Query client defaults

- `staleTime`: 5 minutes
- No retry on 401, 403, 404, 429
- 1 retry for network errors and other failures
- Auto-redirect to `/auth/login` on 401
- Auto-toast errors on mutations (unless `skipToast: true`)

---

## React Hook Form

### Basic pattern (derive schema from contract)

```typescript
import { botsContract } from '@grabdy/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createSchema = botsContract.create.body.pick({ name: true });
type CreateForm = z.infer<typeof createSchema>;

const {
  register,
  handleSubmit,
  formState: { errors, isSubmitting },
  setError,
} = useForm<CreateForm>({
  resolver: zodResolver(createSchema),
  mode: 'onBlur',
  defaultValues: { name: '' },
});

const onSubmit = async (data: CreateForm) => {
  try {
    const res = await api.bots.create({
      params: { orgId: selectedOrgId },
      body: { name: data.name.trim() },
    });
    if (res.status === 200) {
      toast.success('Bot created');
      onClose();
    }
  } catch (err) {
    setError('root', {
      message: err instanceof Error ? err.message : 'Failed to create bot',
    });
  }
};
```

### Schema derivation patterns

```typescript
// Pick subset of fields
const schema = botsContract.create.body.pick({ name: true });

// Make optional fields required for the form
const schema = contract.orgs.update.body.required();

// Pick + require
const schema = botsContract.update.body.required().pick({ name: true, description: true });

// Extend with custom fields (e.g., password confirmation)
const schema = contract.auth.resetPassword.body
  .pick({ password: true })
  .extend({ confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

// Use contract body directly
const schema = contract.apiKeys.create.body;

// Inline schema when no contract exists
const schema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});
```

### TextField integration

```typescript
<TextField
  fullWidth
  label="Name"
  {...register('name')}
  error={!!errors.name}
  helperText={errors.name?.message}
/>
```

### MUI Select with Controller

```typescript
import { Controller } from 'react-hook-form';

<FormControl fullWidth error={!!errors.roles}>
  <InputLabel>Role</InputLabel>
  <Controller
    name="roles"
    control={control}
    render={({ field }) => (
      <Select
        value={field.value[0] ?? 'MEMBER'}
        onChange={(e) => field.onChange([e.target.value])}
        label="Role"
      >
        <MenuItem value="MEMBER">Member</MenuItem>
        <MenuItem value="ADMIN">Admin</MenuItem>
      </Select>
    )}
  />
  <FormHelperText>{errors.roles?.message}</FormHelperText>
</FormControl>
```

### Custom components with Controller (e.g., OTP input)

```typescript
<Controller
  name="otp"
  control={form.control}
  render={({ field }) => <OtpInput {...field} />}
/>
```

### Live preview with watch()

```typescript
const { watch, setValue, register } = useForm<SettingsForm>({ ... });

// Read values reactively
const title = watch('title');
const primaryColor = watch('primaryColor');

// Programmatic update (e.g., from color picker)
setValue('primaryColor', newColor, { shouldDirty: true });
```

### Pre-filling forms with API data

```typescript
// Option 1: values prop (re-renders when data changes)
const { register } = useForm<ProfileForm>({
  resolver: zodResolver(schema),
  values: { firstName: user.firstName, lastName: user.lastName },
});

// Option 2: reset() with fetched data
const { reset } = useForm<OrgForm>({ resolver: zodResolver(schema) });
useEffect(() => {
  if (orgData) reset({ name: orgData.name, domain: orgData.domain });
}, [orgData, reset]);
```

### Multi-step forms

Use separate `useForm` instances per step:

```typescript
// Step 1: Email
const emailForm = useForm({ resolver: zodResolver(emailSchema) });

// Step 2: Verification
const verifyForm = useForm({ resolver: zodResolver(verifySchema) });

const [step, setStep] = useState<'email' | 'verify'>('email');
```

### Error handling

```typescript
// Field errors via helperText
<TextField error={!!errors.name} helperText={errors.name?.message} />

// Root errors (server errors)
setError('root', { message: 'Email already taken' });

// Display root errors
{errors.root?.message && (
  <Alert severity="error">{errors.root?.message}</Alert>
)}

// Clear errors (e.g., before retry)
clearErrors('root');

// Post-submission state
const { isSubmitSuccessful } = formState;
if (isSubmitSuccessful) return <SuccessMessage />;
```

### Rules

- Always derive schema from contract when possible
- Use `formState.isSubmitting` for loading state, never manual useState
- Use `setError('root', ...)` for server errors
- Use `mode: 'onBlur'` as default validation mode
- Zod schemas must include human-readable error messages
- Use `Controller` for MUI Select and custom components
- Use `register()` for standard TextField inputs

---

## Drawer System

Replaces MUI Dialog. NEVER use Dialog components directly.

### Opening a drawer

```typescript
import { useDrawer } from '@/context/DrawerContext';

const { pushDrawer } = useDrawer();

// Right sidebar (default)
pushDrawer(
  (onClose) => <EditBotDrawer bot={bot} onClose={onClose} />,
  { title: 'Edit Bot' }
);

// Dialog mode (centered modal, fullScreen on mobile)
pushDrawer(
  (onClose) => <CreateBotDrawer onClose={onClose} onCreated={handleCreated} />,
  { title: 'Create Bot', mode: 'dialog', maxWidth: 'sm' }
);

// Custom width
pushDrawer(
  (onClose) => <WideContent onClose={onClose} />,
  { title: 'Preview', width: 800 }
);
```

### Options

| Option   | Type                                          | Default   | Description                                     |
| -------- | --------------------------------------------- | --------- | ----------------------------------------------- |
| title    | string                                        | none      | Sticky header title                             |
| mode     | 'drawer' \| 'dialog'                          | 'drawer'  | drawer = right sidebar, dialog = centered modal |
| width    | number \| string                              | 480-560px | Drawer panel width                              |
| maxWidth | 'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| false | 'lg'      | Max width for dialog mode                       |

### Behavior

- Stack-based: can push multiple drawers, `popDrawer()` closes the top one
- `onClose` callback passed to render function handles closing
- Sticky header with title and close (X) button, auto-generated
- Dialog mode: responsive, fullScreen on mobile
- Drawer mode: right-anchored sidebar, 100vw on mobile

### Drawer content component pattern

```typescript
interface CreateBotDrawerProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateBotDrawer({ onClose, onCreated }: CreateBotDrawerProps) {
  const onSubmit = async (data: FormData) => {
    // ... submit
    onCreated();
    onClose();
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ p: 3 }}>
      {/* form fields */}
      <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ mt: 3 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={isSubmitting}>
          Create
        </Button>
      </Stack>
    </Box>
  );
}
```

---

## Toasts (sonner)

```typescript
import { toast } from 'sonner';

toast.success('Bot created');
toast.error('Something went wrong');
toast.loading('Processing...');
```

Globally configured in `main.tsx` with `position="top-right"`, no border radius, project font.

---

## Date Formatting (date-fns)

```typescript
import { relativeDate } from '@/lib/date';

// "2 days ago", "just now", "3 months ago"
relativeDate(item.createdAt);
```

Uses `formatDistanceToNow` from date-fns with `addSuffix: true`.

---

## Routes (TanStack Router)

File-based routing with `createFileRoute()`:

```typescript
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';

// Define route with optional search params
export const Route = createFileRoute('/dashboard/bots/')({
  component: BotsPage,
  validateSearch: z.object({ tab: z.string().optional() }),
});

function BotsPage() {
  const navigate = useNavigate();
  const { tab } = useSearch({ from: '/dashboard/bots/' });

  // Navigate with params
  navigate({ to: '/dashboard/bots/$botId', params: { botId: c.id } });

  // Navigate with search
  navigate({ to: '/dashboard/bots', search: { tab: 'settings' }, replace: true });
}
```

Layout hierarchy: `__root.tsx` > `dashboard.tsx` > `dashboard/bots/index.tsx` > `dashboard/bots/$botId.tsx`

---

## Common UI Components

### DashboardPage

```typescript
<DashboardPage
  title="Sources"
  subtitle="Upload files or connect integrations"
  icon={<FolderIcon size={24} weight="light" color="currentColor" />}
  actions={<Button onClick={openUpload}>Upload</Button>}
  maxWidth={960}
  showBack={true}
>
  {/* content */}
</DashboardPage>
```

### EmptyState

```typescript
<EmptyState
  icon={<ChatCircleIcon size={48} weight="light" color="currentColor" />}
  message="No Bots"
  description="Create a bot to embed a chatbot on your website."
  actionLabel="Create Bot"
  onAction={openCreateDrawer}
/>
```

### PageLoader

```typescript
if (isLoading) return <PageLoader />;
```

### ConfirmDialog (for destructive actions)

```typescript
const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
const deleteMutation = useMutation({ ... });

<ConfirmDialog
  open={!!deleteTarget}
  title="Delete Item"
  message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
  confirmLabel="Delete"
  onConfirm={() => deleteMutation.mutate(deleteTarget)}
  onCancel={() => setDeleteTarget(null)}
  isLoading={deleteMutation.isPending}
/>
```

### MainTable (server-side pagination)

```typescript
<MainTable
  endpoint={api.collections.list}
  endpointParams={{ orgId: selectedOrgId }}
  queryKey={['collections', selectedOrgId]}
  headerNames={{ name: 'Name', created: 'Created' }}
  sortableColumns={['name', 'created']}
  defaultSortBy="created"
  defaultSortOrder="desc"
  defaultLimit={20}
  rowTitle={(c) => c.name}
  keyExtractor={(c) => c.id}
  renderItems={{
    name: (c) => <Typography variant="body2">{c.name}</Typography>,
    created: (c) => (
      <Typography variant="body2" color="text.secondary">
        {relativeDate(c.createdAt)}
      </Typography>
    ),
  }}
  emptyState={<EmptyState message="No items" />}
/>
```

### MainTable (client-side data)

```typescript
<MainTable
  data={items}
  headerNames={{ name: 'Name', actions: '' }}
  columnWidths={{ actions: 80 }}
  rowTitle={(c) => c.name}
  keyExtractor={(c) => c.id}
  onRowClick={(c) => navigate({ to: '/path/$id', params: { id: c.id } })}
  sorting={{
    sortableColumns: ['name', 'created'],
    defaultSort: 'created',
    defaultDirection: 'desc',
    getSortValue: (item, col) => col === 'created' ? new Date(item.createdAt) : item.name,
  }}
  renderItems={{ ... }}
  emptyState={<EmptyState message="No items" />}
/>
```

### CopyButton

```typescript
<CopyButton text={apiKey} size={16} />
```

### FileUpload (drag and drop)

```typescript
<FileUpload
  onFileSelect={(file) => handleUpload(file)}
  disabled={isUploading}
  uploadProgress={progress}
/>
```

---

## Auth Context

```typescript
const {
  user, // User | null
  isLoading, // boolean
  isAuthenticated, // boolean
  selectedOrgId, // DbId<'Org'> | undefined
  isAdmin, // boolean (derived from role)
  isOwner, // boolean (derived from role)
  selectOrg, // (orgId: DbId<'Org'>) => void
  login, // (email, password) => Promise<void>
  logout, // () => Promise<void>
  refetch, // () => Promise<void>
} = useAuth();
```

- Org selection persisted to localStorage
- `selectOrg()` clears all query cache
- All org-scoped API calls use `selectedOrgId` as path param

---

## Hooks Pattern

Hooks accept a params object, one hook per file:

```typescript
interface UseChatStreamParams {
  ensureThread: () => Promise<DbId<'ChatThread'>>;
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  botId?: DbId<'Bot'>;
}

export function useChatStream({ ensureThread, setMessages, botId }: UseChatStreamParams) {
  const { selectedOrgId } = useAuth();
  const [isStreaming, setIsStreaming] = useState(false);

  const handleSend = useCallback(
    async (message: string, files?: File[]) => {
      // ...
    },
    [dependencies]
  );

  return { isStreaming, handleSend };
}
```

---

## Contracts

All contracts follow this response pattern:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

Contract body schemas have human-readable Zod error messages:

```typescript
z.string().email('Please enter a valid email');
z.string().min(8, 'Password must be at least 8 characters');
```
