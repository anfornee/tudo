export function calculatePowerPercentiles(samples: number[]) {
	if (!samples.length) {
		return {
			p10: 0,
			p25: 0,
			p50: 0,
			p75: 0,
			p90: 0,
			p95: 0,
		};
	}

	const sorted = [...samples].sort((a, b) => a - b);

	const percentile = (p: number) => {
		const index = (sorted.length - 1) * p;
		const lower = Math.floor(index);
		const upper = Math.ceil(index);

		if (lower === upper) {
			return sorted[lower];
		}

		return sorted[lower] +
			(sorted[upper] - sorted[lower]) *
			(index - lower);
	};

	return {
		p10: Math.round(percentile(0.10)),
		p25: Math.round(percentile(0.25)),
		p50: Math.round(percentile(0.50)),
		p75: Math.round(percentile(0.75)),
		p90: Math.round(percentile(0.90)),
		p95: Math.round(percentile(0.95)),
	};
}
