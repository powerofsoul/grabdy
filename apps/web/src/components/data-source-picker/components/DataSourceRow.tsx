import type { DbId } from '@grabdy/common';
import { Checkbox, ListItem, ListItemText } from '@mui/material';

interface DataSourceRowProps {
  id: DbId<'DataSource'>;
  title: string;
  checked: boolean;
  onToggle: (id: DbId<'DataSource'>, checked: boolean) => void;
}

export function DataSourceRow({ id, title, checked, onToggle }: DataSourceRowProps) {
  return (
    <ListItem dense sx={{ pl: 6 }}>
      <Checkbox checked={checked} onChange={(_, v) => onToggle(id, v)} size="small" />
      <ListItemText primary={title} primaryTypographyProps={{ variant: 'body2' }} />
    </ListItem>
  );
}
