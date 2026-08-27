'use client';

import Typography from '@mui/material/Typography';
import { motion } from 'motion/react';
import PageBreadcrumb from 'src/components/PageBreadcrumb';
import { ReactNode } from 'react';

type AdminPageHeaderProps = {
	title: string;
	subtitle?: string;
	action?: ReactNode;
};

function AdminPageHeader(props: AdminPageHeaderProps) {
	const { title, subtitle, action } = props;

	return (
		<div className="flex w-full flex-col py-3 md:py-4">
			<PageBreadcrumb className="mb-4 opacity-80" />
			<div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex min-w-0 flex-1 flex-col">
					<motion.span
						initial={{ x: -16, opacity: 0 }}
						animate={{ x: 0, opacity: 1, transition: { delay: 0.08 } }}
					>
						<Typography className="text-4xl leading-none font-extrabold tracking-tight md:text-5xl">
							{title}
						</Typography>
					</motion.span>
					{subtitle && (
						<Typography
							className="mt-2 max-w-2xl text-sm leading-relaxed md:text-base"
							color="text.secondary"
						>
							{subtitle}
						</Typography>
					)}
				</div>
				{action && (
					<motion.div
						className="flex shrink-0 sm:ml-4"
						initial={{ opacity: 0, x: 12 }}
						animate={{ opacity: 1, x: 0, transition: { delay: 0.12 } }}
					>
						{action}
					</motion.div>
				)}
			</div>
		</div>
	);
}

export default AdminPageHeader;
