import "server-only";

const WEATHER_API_URL = "https://api.weather.gov";

const weatherHeaders = {
	Accept: "application/geo+json",
	"User-Agent":
		process.env.WEATHER_USER_AGENT ??
		"(Life Tracker, contact@example.com)",
};

export interface CurrentWeather {
	temperature: number | null;
	condition: string;
	humidity: number | null;
	windSpeed: number | null;
	windDirection: number | null;
}

export interface HourlyWeather {
	startTime: string;
	temperature: number;
	temperatureUnit: string;
	shortForecast: string;
	precipitationChance: number | null;
	windSpeed: string;
	windDirection: string;
}

export interface DailyWeather {
	name: string;
	startTime: string;
	temperature: number;
	temperatureUnit: string;
	shortForecast: string;
	precipitationChance: number | null;
	windSpeed: string;
	windDirection: string;
}

export interface WeatherData {
	current: CurrentWeather;
	hourly: HourlyWeather[];
	daily: DailyWeather[];
}

interface NwsPointResponse {
	properties: {
		forecast: string;
		forecastHourly: string;
		observationStations: string;
	};
}

interface NwsForecastPeriod {
	number: number;
	name: string;
	startTime: string;
	endTime: string;
	isDaytime: boolean;
	temperature: number;
	temperatureUnit: string;
	temperatureTrend: string | null;
	probabilityOfPrecipitation: {
		unitCode: string;
		value: number | null;
	};
	windSpeed: string;
	windDirection: string;
	shortForecast: string;
	detailedForecast: string;
}

interface NwsForecastResponse {
	properties: {
		periods: NwsForecastPeriod[];
	};
}

interface NwsStationCollection {
	features: Array<{
		properties: {
			stationIdentifier: string;
			name: string;
		};
	}>;
}

interface NwsObservationResponse {
	properties: {
		textDescription: string;
		temperature: {
			value: number | null;
		};
		relativeHumidity: {
			value: number | null;
		};
		windSpeed: {
			value: number | null;
		};
		windDirection: {
			value: number | null;
		};
	};
}

function celsiusToFahrenheit(value: number | null): number | null {
	if (value === null) {
		return null;
	}

	return Math.round((value * 9) / 5 + 32);
}

function kilometersPerHourToMph(value: number | null): number | null {
	if (value === null) {
		return null;
	}

	return Math.round(value * 0.621371);
}

async function fetchNws<T>(
	url: string,
	revalidate: number
): Promise<T> {
	const response = await fetch(url, {
		headers: weatherHeaders,
		next: {
			revalidate,
		},
	});

	if (!response.ok) {
		throw new Error(
			`NWS request failed: ${response.status} ${response.statusText}`
		);
	}

	return response.json() as Promise<T>;
}

async function getWeatherPoint(
	latitude: number,
	longitude: number
): Promise<NwsPointResponse> {
	return fetchNws<NwsPointResponse>(
		`${WEATHER_API_URL}/points/${latitude},${longitude}`,
		60 * 60 * 12
	);
}

async function getCurrentWeather(
	observationStationsUrl: string
): Promise<CurrentWeather> {
	const stationCollection =
		await fetchNws<NwsStationCollection>(
			observationStationsUrl,
			60 * 60 * 12
		);

	const station = stationCollection.features[0];

	if (!station) {
		throw new Error("No NWS observation station found.");
	}

	const observation =
		await fetchNws<NwsObservationResponse>(
			`${WEATHER_API_URL}/stations/${station.properties.stationIdentifier}/observations/latest`,
			60 * 10
		);

	return {
		temperature: celsiusToFahrenheit(
			observation.properties.temperature.value
		),
		condition:
			observation.properties.textDescription || "Unknown",
		humidity:
			observation.properties.relativeHumidity.value !== null
				? Math.round(
						observation.properties.relativeHumidity.value
					)
				: null,
		windSpeed: kilometersPerHourToMph(
			observation.properties.windSpeed.value
		),
		windDirection:
			observation.properties.windDirection.value !== null
				? Math.round(
						observation.properties.windDirection.value
					)
				: null,
	};
}

async function getHourlyForecast(
	forecastHourlyUrl: string
): Promise<HourlyWeather[]> {
	const forecast =
		await fetchNws<NwsForecastResponse>(
			forecastHourlyUrl,
			60 * 30
		);

	return forecast.properties.periods
		.slice(0, 24)
		.map((period) => ({
			startTime: period.startTime,
			temperature: period.temperature,
			temperatureUnit: period.temperatureUnit,
			shortForecast: period.shortForecast,
			precipitationChance:
				period.probabilityOfPrecipitation.value,
			windSpeed: period.windSpeed,
			windDirection: period.windDirection,
		}));
}

async function getDailyForecast(
	forecastUrl: string
): Promise<DailyWeather[]> {
	const forecast =
		await fetchNws<NwsForecastResponse>(
			forecastUrl,
			60 * 30
		);

	return forecast.properties.periods
		.filter((period) => period.isDaytime)
		.slice(0, 5)
		.map((period) => ({
			name: period.name,
			startTime: period.startTime,
			temperature: period.temperature,
			temperatureUnit: period.temperatureUnit,
			shortForecast: period.shortForecast,
			precipitationChance:
				period.probabilityOfPrecipitation.value,
			windSpeed: period.windSpeed,
			windDirection: period.windDirection,
		}));
}

export async function getWeather(
	latitude: number,
	longitude: number
): Promise<WeatherData> {
	const point = await getWeatherPoint(latitude, longitude);

	const [current, hourly, daily] = await Promise.all([
		getCurrentWeather(point.properties.observationStations),
		getHourlyForecast(point.properties.forecastHourly),
		getDailyForecast(point.properties.forecast),
	]);

	return {
		current,
		hourly,
		daily,
	};
}