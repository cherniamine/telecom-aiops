import joblib
import numpy as np
import pandas as pd
from threading import Lock


class HybridAnomalyDetector:

    _shared_artifacts = None
    _artifacts_lock = Lock()

    def __init__(self):

        artifacts = self._get_shared_artifacts()
        self.iso = artifacts["iso"]
        self.lof = artifacts["lof"]
        self.vectorizer = artifacts["vectorizer"]
        self.feature_names = artifacts["feature_names"]
        self.iso_scaler = artifacts["iso_scaler"]
        self.lof_scaler = artifacts["lof_scaler"]
        self.text_scaler = artifacts["text_scaler"]
        self.weights = artifacts["weights"]

        # base structured features
        self.base_features = [
            "message_length",
            "hour",
            "weekday",
            "is_error",
            "is_warning"
        ]

        # stable platform encoding
        self.platforms = [
            "smsc",
            "smpps",
            "smppc",
            "dmc",
            "mmg"
        ]

    @classmethod
    def _get_shared_artifacts(cls):
        if cls._shared_artifacts is not None:
            return cls._shared_artifacts

        with cls._artifacts_lock:
            if cls._shared_artifacts is None:
                cls._shared_artifacts = {
                    "iso": joblib.load("ml/models/isolation_forest.pkl"),
                    "lof": joblib.load("ml/models/lof.pkl"),
                    "vectorizer": joblib.load("ml/models/tfidf.pkl"),
                    "feature_names": joblib.load("ml/models/features.pkl"),
                    "iso_scaler": joblib.load("ml/models/iso_scaler.pkl"),
                    "lof_scaler": joblib.load("ml/models/lof_scaler.pkl"),
                    "text_scaler": joblib.load("ml/models/text_scaler.pkl"),
                    "weights": joblib.load("ml/models/weights.pkl"),
                }

        return cls._shared_artifacts


    # =========================================================
    # STRUCTURED FEATURE PREPROCESSING
    # =========================================================

    def preprocess(self, df):

        df_struct = df[self.base_features + ["platform"]].copy()

        # stable encoding identical to training
        for p in self.platforms:
            df_struct[f"platform_{p}"] = (
                df_struct["platform"] == p
            ).astype(int)

        df_struct.drop(columns=["platform"], inplace=True)

        # strict alignment with training features
        df_struct = df_struct.reindex(
            columns=self.feature_names,
            fill_value=0
        )

        return df_struct


    # =========================================================
    # SCORE NORMALIZATION
    # =========================================================

    def normalize_scores(
        self,
        iso_raw,
        lof_raw,
        text_raw
    ):

        iso_score = 1 - self.iso_scaler.transform(
            iso_raw.reshape(-1, 1)
        ).flatten()

        lof_score = 1 - self.lof_scaler.transform(
            lof_raw.reshape(-1, 1)
        ).flatten()

        text_score = 1 - self.text_scaler.transform(
            text_raw.reshape(-1, 1)
        ).flatten()

        return iso_score, lof_score, text_score


    # =========================================================
    # MAIN PREDICTION FUNCTION
    # =========================================================

    def predict(self, df):

        X_struct = self.preprocess(df)

        # structured anomaly scores
        iso_raw = self.iso.decision_function(X_struct)

        lof_raw = self.lof.decision_function(
            X_struct.values
        )

        # NLP anomaly signal
        X_text = self.vectorizer.transform(
            df["message"]
        )

        text_raw = np.asarray(
            X_text.mean(axis=1)
        ).flatten()

        # normalize scores
        iso_score, lof_score, text_score = (
            self.normalize_scores(
                iso_raw,
                lof_raw,
                text_raw
            )
        )

        # weighted fusion
        final_score = (

            self.weights["iso"] * iso_score
            +
            self.weights["lof"] * lof_score
            +
            self.weights["text"] * text_score

        )

        return final_score


    # =========================================================
    # CONFIDENCE ESTIMATION
    # =========================================================

    def predict_with_confidence(self, df):

        X_struct = self.preprocess(df)

        iso_raw = self.iso.decision_function(X_struct)

        lof_raw = self.lof.decision_function(
            X_struct.values
        )

        X_text = self.vectorizer.transform(
            df["message"]
        )

        text_raw = np.asarray(
            X_text.mean(axis=1)
        ).flatten()

        iso_score, lof_score, text_score = (
            self.normalize_scores(
                iso_raw,
                lof_raw,
                text_raw
            )
        )

        final_score = (

            self.weights["iso"] * iso_score
            +
            self.weights["lof"] * lof_score
            +
            self.weights["text"] * text_score

        )

        # confidence = agreement between models
        stacked_scores = np.vstack([
            iso_score,
            lof_score,
            text_score
        ])

        confidence = 1 - np.std(
            stacked_scores,
            axis=0
        )

        confidence = np.clip(
            confidence,
            0,
            1
        )

        return final_score, confidence


    # =========================================================
    # LABEL CONVERSION FUNCTION
    # =========================================================

    def predict_labels(
        self,
        df,
        threshold=0.65
    ):

        scores = self.predict(df)

        labels = (
            scores > threshold
        ).astype(int)

        return labels
