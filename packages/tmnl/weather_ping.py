#!/usr/bin/env python3
import json
import sys
import urllib.parse
import urllib.request


def get_json(url: str) -> dict:
    with urllib.request.urlopen(url, timeout=10) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status} from {url}")
        return json.loads(resp.read().decode("utf-8"))


def get_location(city: str) -> tuple[float, float, str]:
    q = urllib.parse.urlencode({"name": city, "count": 1, "language": "en", "format": "json"})
    url = f"https://geocoding-api.open-meteo.com/v1/search?{q}"
    data = get_json(url)

    results = data.get("results")
    if not results:
        raise ValueError(f"City not found: {city}")

    r = results[0]
    name = f'{r.get("name")}, {r.get("country", "")}'.strip(", ")
    return r["latitude"], r["longitude"], name


def get_current_weather(lat: float, lon: float) -> dict:
    q = urllib.parse.urlencode({
        "latitude": lat,
        "longitude": lon,
        "current": "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
        "timezone": "auto",
    })
    url = f"https://api.open-meteo.com/v1/forecast?{q}"
    data = get_json(url)
    return data.get("current", {})


def main():
    city = sys.argv[1] if len(sys.argv) > 1 else "London"

    try:
        lat, lon, label = get_location(city)
        current = get_current_weather(lat, lon)

        print(f"Weather ping OK for: {label} ({lat:.3f}, {lon:.3f})")
        print(f"Time: {current.get('time')}")
        print(f"Temperature: {current.get('temperature_2m')} °C")
        print(f"Humidity: {current.get('relative_humidity_2m')} %")
        print(f"Wind: {current.get('wind_speed_10m')} km/h")
        print(f"Weather code: {current.get('weather_code')}")
    except Exception as e:
        print(f"Weather ping failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
