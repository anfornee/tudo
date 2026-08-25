export function calculateBestAverage(
	samples: number[],
	windowSeconds: number,
): number | null {
	if (samples.length < windowSeconds) {
		return null;
	}

	let best = 0;
	let rollingSum = 0;

	for (let i = 0; i < samples.length; i++) {
		rollingSum += samples[i];

		if (i >= windowSeconds) {
			rollingSum -= samples[i - windowSeconds];
		}

		if (i >= windowSeconds - 1) {
			best = Math.max(best, rollingSum / windowSeconds);
		}
	}

	return Math.round(best);
}

export function calculateNormalizedPower(
	samples: number[],
): number | null {
	if (samples.length < 30) {
		return null;
	}

	const rolling: number[] = [];
	let sum = 0;

	for (let i = 0; i < samples.length; i++) {
		sum += samples[i];

		if (i >= 30) {
			sum -= samples[i - 30];
		}

		if (i >= 29) {
			rolling.push(sum / 30);
		}
	}

	const fourthPowerMean =
		rolling.reduce(
			(total, power) => total + power ** 4,
			0,
		) / rolling.length;

	return Math.round(fourthPowerMean ** 0.25);
}

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