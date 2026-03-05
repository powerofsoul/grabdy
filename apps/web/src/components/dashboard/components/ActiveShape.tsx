import { Sector } from 'recharts';
import type { PieSectorDataItem } from 'recharts/types/polar/Pie';

export function ActiveShape(props: PieSectorDataItem) {
  return <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 4} />;
}
