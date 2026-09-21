'use client';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { alpha } from '@mui/material/styles';
import type { SupportCounts } from '@/app/(control-panel)/ops/api/types';
import { QUEUE_FILTERS } from './status';

type SupportFiltersProps = {
	value: string;
	counts?: SupportCounts;
	onChange: (filter: string) => void;
};

/// Deliberately left unstyled. The Fuse theme already renders MUI tabs as a
/// segmented control — a filled track with a raised thumb behind the active tab —
/// so any background or indicator set here only fights it. The counts are the one
/// addition, with the waiting queue tinted because that is the number an agent is
/// actually watching.
function SupportFilters(props: SupportFiltersProps) {
	const { value, counts, onChange } = props;

	return (
		<Tabs
			value={value}
			onChange={(_event, next: string) => onChange(next)}
			variant="scrollable"
			scrollButtons={false}
		>
			{QUEUE_FILTERS.map((option) => {
				const count = counts?.[option.countKey] ?? 0;

				return (
					<Tab
						key={option.value}
						value={option.value}
						disableRipple
						label={
							<span className="flex items-center gap-1.5">
								{option.label}
								{count > 0 && (
									<Box
										component="span"
										sx={(theme) => ({
											px: 0.625,
											borderRadius: 5,
											fontSize: 10,
											fontWeight: 700,
											lineHeight: '16px',
											backgroundColor: option.urgent
												? alpha(theme.palette.warning.main, 0.18)
												: theme.palette.action.selected,
											color: option.urgent
												? theme.palette.warning.main
												: theme.palette.text.secondary
										})}
									>
										{count}
									</Box>
								)}
							</span>
						}
					/>
				);
			})}
		</Tabs>
	);
}

export default SupportFilters;
