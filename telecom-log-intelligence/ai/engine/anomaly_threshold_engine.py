import numpy as np


class AnomalyThresholdEngine:

    BASE_THRESHOLDS = {
        "SMSC": 0.38,
        "MMG": 0.40,
        "SMPPS": 0.35,
        "SMPPC": 0.35,
        "DMC": 0.38,
        "DEFAULT": 0.40,
    }

    HOUR_MODIFIERS = {
        "night": {"hours": range(0, 6), "modifier": 1.15},
        "morning": {"hours": range(6, 10), "modifier": 1.0},
        "peak": {"hours": range(10, 18), "modifier": 0.90},
        "evening": {"hours": range(18, 24), "modifier": 1.05},
    }

    WEEKDAY_MODIFIERS = {
        "weekend": {"days": [5, 6], "modifier": 1.20},
        "weekday": {"days": range(0, 5), "modifier": 1.0},
    }

    def __init__(self, custom_thresholds=None):
        self.thresholds = dict(self.BASE_THRESHOLDS)

        if custom_thresholds:
            self.thresholds.update(
                {
                    str(key).upper(): float(value)
                    for key, value in custom_thresholds.items()
                }
            )

        self._score_history = {}

    def get_threshold(
        self,
        platform,
        hour,
        weekday,
        log_volume=None,
    ):
        base_threshold = self.thresholds.get(
            str(platform or "").upper(),
            self.thresholds["DEFAULT"],
        )
        hour_modifier = self._get_hour_modifier(int(hour))
        weekday_modifier = self._get_weekday_modifier(int(weekday))
        volume_modifier = self._get_volume_modifier(
            platform,
            log_volume,
        )
        threshold = (
            base_threshold
            * hour_modifier
            * weekday_modifier
            * volume_modifier
        )

        return round(max(0.40, min(0.90, threshold)), 4)

    def update_score_history(self, platform, scores):
        normalized_platform = str(platform or "DEFAULT").upper()

        if normalized_platform not in self._score_history:
            self._score_history[normalized_platform] = []

        self._score_history[normalized_platform].extend(
            [float(score) for score in scores]
        )

        if len(self._score_history[normalized_platform]) > 50000:
            self._score_history[normalized_platform] = (
                self._score_history[normalized_platform][-50000:]
            )

    def get_percentile_threshold(self, platform, percentile=95.0):
        normalized_platform = str(platform or "DEFAULT").upper()
        history = self._score_history.get(normalized_platform, [])

        if len(history) < 1000:
            return None

        return round(float(np.percentile(history, percentile)), 4)

    def get_threshold_report(
        self,
        platform,
        hour,
        weekday,
        log_volume=None,
    ):
        base_threshold = self.thresholds.get(
            str(platform or "").upper(),
            self.thresholds["DEFAULT"],
        )
        hour_modifier = self._get_hour_modifier(int(hour))
        weekday_modifier = self._get_weekday_modifier(int(weekday))
        volume_modifier = self._get_volume_modifier(
            platform,
            log_volume,
        )
        final_threshold = self.get_threshold(
            platform=platform,
            hour=hour,
            weekday=weekday,
            log_volume=log_volume,
        )
        percentile_threshold = self.get_percentile_threshold(platform)

        return {
            "platform": str(platform or "DEFAULT").upper(),
            "hour": int(hour),
            "weekday": int(weekday),
            "period": self._get_period_name(int(hour)),
            "day_type": "Week-end" if int(weekday) >= 5 else "Jour ouvre",
            "base_threshold": base_threshold,
            "hour_modifier": hour_modifier,
            "weekday_modifier": weekday_modifier,
            "volume_modifier": volume_modifier,
            "final_threshold": final_threshold,
            "percentile_95": percentile_threshold,
            "recommendation": (
                f"Seuil abaisse a {final_threshold} (periode de pointe, detection maximale)"
                if final_threshold < base_threshold
                else f"Seuil releve a {final_threshold} (trafic reduit, moins de faux positifs)"
            ),
        }

    def _get_hour_modifier(self, hour):
        for period in self.HOUR_MODIFIERS.values():
            if hour in period["hours"]:
                return period["modifier"]

        return 1.0

    def _get_weekday_modifier(self, weekday):
        if weekday in self.WEEKDAY_MODIFIERS["weekend"]["days"]:
            return self.WEEKDAY_MODIFIERS["weekend"]["modifier"]

        return self.WEEKDAY_MODIFIERS["weekday"]["modifier"]

    def _get_volume_modifier(self, platform, log_volume):
        if log_volume is None:
            return 1.0

        reference_volumes = {
            "SMSC": 5000,
            "MMG": 3000,
            "SMPPS": 2000,
            "SMPPC": 1000,
            "DMC": 1500,
            "DEFAULT": 2000,
        }

        reference_volume = reference_volumes.get(
            str(platform or "").upper(),
            reference_volumes["DEFAULT"],
        )
        ratio = float(log_volume) / float(reference_volume)

        if ratio > 3.0:
            return 0.85
        if ratio > 2.0:
            return 0.92
        if ratio < 0.3:
            return 1.10

        return 1.0

    def _get_period_name(self, hour):
        for name, period in self.HOUR_MODIFIERS.items():
            if hour in period["hours"]:
                return name

        return "unknown"
