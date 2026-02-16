import { useCallback, useState } from 'react';

import {
  alpha,
  Box,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { ChartBarIcon, ChartLineIcon, ChartPieIcon, PlusIcon, TrashIcon, XIcon } from '@phosphor-icons/react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { useEditMode } from '../../hooks/useEditMode';

import { COLORS } from './constants';

interface ChartComponentProps {
  data: {
    chartType: 'bar' | 'line' | 'pie';
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      color?: string;
    }>;
  };
  onSave?: (data: Record<string, unknown>) => void;
}

export function ChartComponent({ data, onSave }: ChartComponentProps) {
  const theme = useTheme();
  const textColor = theme.palette.text.secondary;
  const [isEditing, setIsEditing] = useState(false);
  const [draftChartType, setDraftChartType] = useState(data.chartType);
  const [draftLabels, setDraftLabels] = useState(data.labels);
  const [draftDatasets, setDraftDatasets] = useState(data.datasets);

  const handleSave = useCallback(() => {
    onSave?.({ chartType: draftChartType, labels: draftLabels, datasets: draftDatasets });
    setIsEditing(false);
  }, [draftChartType, draftLabels, draftDatasets, onSave]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const { endEdit } = useEditMode(handleSave, handleCancel, () => {
    setDraftChartType(data.chartType);
    setDraftLabels([...data.labels]);
    setDraftDatasets(data.datasets.map((ds) => ({ ...ds, data: [...ds.data] })));
    setIsEditing(true);
  });

  const handleAddLabel = () => {
    setDraftLabels((prev) => [...prev, `Label ${prev.length + 1}`]);
    setDraftDatasets((prev) => prev.map((ds) => ({ ...ds, data: [...ds.data, 0] })));
  };

  const handleRemoveLabel = (index: number) => {
    setDraftLabels((prev) => prev.filter((_, i) => i !== index));
    setDraftDatasets((prev) =>
      prev.map((ds) => ({ ...ds, data: ds.data.filter((_, i) => i !== index) })),
    );
  };

  const handleAddDataset = () => {
    setDraftDatasets((prev) => [
      ...prev,
      { label: `Series ${prev.length + 1}`, data: draftLabels.map(() => 0) },
    ]);
  };

  const handleRemoveDataset = (index: number) => {
    setDraftDatasets((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLabelChange = (index: number, value: string) => {
    setDraftLabels((prev) => prev.map((l, i) => (i === index ? value : l)));
  };

  const handleDataChange = (dsIndex: number, labelIndex: number, value: number) => {
    setDraftDatasets((prev) => {
      const updated = prev.map((ds) => ({ ...ds, data: [...ds.data] }));
      updated[dsIndex].data[labelIndex] = value;
      return updated;
    });
  };

  const handleDatasetLabelChange = (dsIndex: number, label: string) => {
    setDraftDatasets((prev) =>
      prev.map((ds, i) => (i === dsIndex ? { ...ds, label } : ds)),
    );
  };

  const handleDatasetColorChange = (dsIndex: number, color: string) => {
    setDraftDatasets((prev) =>
      prev.map((ds, i) => (i === dsIndex ? { ...ds, color: color || undefined } : ds)),
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
      endEdit();
    }
  };

  if (isEditing) {
    return (
      <Box
        className="nodrag nowheel nopan"
        onKeyDown={handleKeyDown}
        sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1 }}
      >
        {/* Chart type selector */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Type</Typography>
          <ToggleButtonGroup
            value={draftChartType}
            exclusive
            onChange={(_, v) => { if (v) setDraftChartType(v); }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.25 } }}
          >
            <ToggleButton value="bar"><Tooltip title="Bar"><ChartBarIcon size={14} weight="light" color="currentColor" /></Tooltip></ToggleButton>
            <ToggleButton value="line"><Tooltip title="Line"><ChartLineIcon size={14} weight="light" color="currentColor" /></Tooltip></ToggleButton>
            <ToggleButton value="pie"><Tooltip title="Pie"><ChartPieIcon size={14} weight="light" color="currentColor" /></Tooltip></ToggleButton>
          </ToggleButtonGroup>
        </Box>

        {/* Labels (XIcon-axis categories) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Labels</Typography>
            <IconButton size="small" onClick={handleAddLabel} sx={{ width: 20, height: 20, color: 'primary.main' }}>
              <PlusIcon size={12} weight="light" color="currentColor" />
            </IconButton>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {draftLabels.map((label, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <TextField
                  size="small"
                  value={label}
                  onChange={(e) => handleLabelChange(i, e.target.value)}
                  sx={{ width: 80, '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5 } }}
                />
                {draftLabels.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveLabel(i)}
                    sx={{ width: 16, height: 16, p: 0, color: alpha(theme.palette.text.primary, 0.3) }}
                  >
                    <XIcon size={10} weight="light" color="currentColor" />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        {/* Datasets (series) */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 600, color: 'text.secondary' }}>Series</Typography>
            <IconButton size="small" onClick={handleAddDataset} sx={{ width: 20, height: 20, color: 'primary.main' }}>
              <PlusIcon size={12} weight="light" color="currentColor" />
            </IconButton>
          </Box>
          {draftDatasets.map((ds, di) => (
            <Box key={di} sx={{ mb: 1, p: 0.75, border: '1px solid', borderColor: alpha(theme.palette.text.primary, 0.08), borderRadius: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                <TextField
                  size="small"
                  value={ds.label}
                  onChange={(e) => handleDatasetLabelChange(di, e.target.value)}
                  placeholder="Series name"
                  sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: 11, py: 0.25, px: 0.5, fontWeight: 600 } }}
                />
                <Box
                  component="input"
                  type="color"
                  value={ds.color ?? COLORS[di % COLORS.length]}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleDatasetColorChange(di, e.target.value)}
                  sx={{ width: 24, height: 24, border: 'none', p: 0, cursor: 'pointer', borderRadius: 0.5 }}
                />
                {draftDatasets.length > 1 && (
                  <IconButton
                    size="small"
                    onClick={() => handleRemoveDataset(di)}
                    sx={{ width: 20, height: 20, color: alpha(theme.palette.text.primary, 0.3) }}
                  >
                    <TrashIcon size={11} weight="light" color="currentColor" />
                  </IconButton>
                )}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {draftLabels.map((label, li) => (
                  <Box key={li} sx={{ display: 'flex', flexDirection: 'column', gap: 0.15 }}>
                    <Typography sx={{ fontSize: 9, color: 'text.secondary' }}>{label}</Typography>
                    <TextField
                      size="small"
                      type="number"
                      value={ds.data[li] ?? 0}
                      onChange={(e) => handleDataChange(di, li, parseFloat(e.target.value) || 0)}
                      sx={{ width: 64, '& .MuiInputBase-input': { fontSize: 11, py: 0.2, px: 0.5 } }}
                    />
                  </Box>
                ))}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  const renderChart = () => {
    if (data.chartType === 'pie') {
      const pieData = data.labels.map((label, i) => ({
        name: label,
        value: data.datasets[0]?.data[i] ?? 0,
      }));

      return (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {pieData.map((_, i) => (
                <Cell key={i} fill={data.datasets[0]?.color ?? COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <RTooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    const chartData = data.labels.map((label, i) => {
      const point: Record<string, unknown> = { name: label };
      for (const ds of data.datasets) {
        point[ds.label] = ds.data[i] ?? 0;
      }
      return point;
    });

    const ChartType = data.chartType === 'line' ? LineChart : BarChart;

    return (
      <ResponsiveContainer width="100%" height={200}>
        <ChartType data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: textColor }} />
          <YAxis tick={{ fontSize: 11, fill: textColor }} />
          <RTooltip />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {data.datasets.map((ds, i) =>
            data.chartType === 'line' ? (
              <Line
                key={ds.label}
                type="monotone"
                dataKey={ds.label}
                stroke={ds.color ?? COLORS[i % COLORS.length]}
                strokeWidth={2}
                dot={false}
              />
            ) : (
              <Bar
                key={ds.label}
                dataKey={ds.label}
                fill={ds.color ?? COLORS[i % COLORS.length]}
              />
            ),
          )}
        </ChartType>
      </ResponsiveContainer>
    );
  };

  return (
    <Box
      sx={{ position: 'relative' }}
    >
      {renderChart()}
    </Box>
  );
}
