"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";

interface WeatherData {
  temperature: number;
  weatherCode: number;
  windSpeed: number;
  humidity: number;
}

const WEATHER_ICONS: Record<number, string> = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️",
  71: "🌨️", 73: "🌨️", 75: "❄️",
  77: "❄️", 80: "🌧️", 81: "🌧️", 82: "🌧️",
  85: "🌨️", 86: "🌨️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

const WEATHER_DESC: Record<string, Record<number, string>> = {
  ko: { 0: "맑음", 1: "대체로 맑음", 2: "구름 조금", 3: "흐림", 45: "안개", 48: "안개", 51: "이슬비", 53: "이슬비", 55: "이슬비", 61: "비", 63: "비", 65: "폭우", 71: "눈", 73: "눈", 75: "폭설", 80: "소나기", 81: "소나기", 82: "폭우", 95: "뇌우", 96: "뇌우", 99: "뇌우" },
  en: { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog", 51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain", 71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" },
  ja: { 0: "晴れ", 1: "おおむね晴れ", 2: "一部曇り", 3: "曇り", 45: "霧", 48: "霧", 51: "霧雨", 53: "霧雨", 55: "霧雨", 61: "雨", 63: "雨", 65: "大雨", 71: "雪", 73: "雪", 75: "大雪", 80: "にわか雨", 81: "にわか雨", 82: "大雨", 95: "雷雨", 96: "雷雨", 99: "雷雨" },
  zh: { 0: "晴", 1: "大部晴朗", 2: "局部多云", 3: "阴", 45: "雾", 48: "雾", 51: "毛毛雨", 53: "毛毛雨", 55: "毛毛雨", 61: "雨", 63: "雨", 65: "大雨", 71: "雪", 73: "雪", 75: "大雪", 80: "阵雨", 81: "阵雨", 82: "大雨", 95: "雷暴", 96: "雷暴", 99: "雷暴" },
};

interface WeatherWidgetProps {
  latitude?: number | null;
  longitude?: number | null;
}

export default function WeatherWidget({ latitude, longitude }: WeatherWidgetProps) {
  const { locale } = useI18n();
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const lat = latitude ?? 37.5665;
  const lon = longitude ?? 126.978;

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m`
        );
        const data = await res.json();
        if (data.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
            windSpeed: Math.round(data.current.wind_speed_10m),
            humidity: data.current.relative_humidity_2m,
          });
        }
      } catch {}
    };
    fetchWeather();
  }, [lat, lon]);

  if (!weather) return null;

  const icon = WEATHER_ICONS[weather.weatherCode] ?? "🌡️";
  const desc = WEATHER_DESC[locale]?.[weather.weatherCode] ?? WEATHER_DESC["en"]?.[weather.weatherCode] ?? "";

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3">
      <span className="text-3xl">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-bold text-gray-900">{weather.temperature}°</span>
          <span className="text-sm text-gray-500">{desc}</span>
        </div>
        <div className="mt-0.5 flex gap-3 text-xs text-gray-400">
          <span>💧 {weather.humidity}%</span>
          <span>💨 {weather.windSpeed}km/h</span>
        </div>
      </div>
    </div>
  );
}
