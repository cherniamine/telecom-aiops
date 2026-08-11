import numpy as np


class CausalInferenceEngine:

    def compute_causality(self, df):
        if df.empty:
            return []

        correlations = df.corr(numeric_only=True)

        return self._build_links(correlations)

    def compute_causality_from_batches(self, batches):
        columns = None
        count_matrix = None
        sum_x = None
        sum_y = None
        sum_x2 = None
        sum_y2 = None
        sum_xy = None

        for batch_df in batches:
            if batch_df.empty:
                continue

            numeric_df = batch_df.select_dtypes(include=["number"])

            if numeric_df.empty:
                continue

            if columns is None:
                columns = list(numeric_df.columns)
                size = len(columns)
                shape = (size, size)
                count_matrix = np.zeros(shape, dtype=np.float64)
                sum_x = np.zeros(shape, dtype=np.float64)
                sum_y = np.zeros(shape, dtype=np.float64)
                sum_x2 = np.zeros(shape, dtype=np.float64)
                sum_y2 = np.zeros(shape, dtype=np.float64)
                sum_xy = np.zeros(shape, dtype=np.float64)

            array = numeric_df.to_numpy(dtype=np.float64, copy=False)
            mask = np.isfinite(array).astype(np.float64)
            clean = np.where(mask > 0, array, 0.0)
            squared = clean * clean

            count_matrix += mask.T @ mask
            sum_x += clean.T @ mask
            sum_y += mask.T @ clean
            sum_x2 += squared.T @ mask
            sum_y2 += mask.T @ squared
            sum_xy += clean.T @ clean

        if columns is None:
            return []

        with np.errstate(divide="ignore", invalid="ignore"):
            numerator = sum_xy - (sum_x * sum_y) / count_matrix
            variance_x = sum_x2 - (sum_x * sum_x) / count_matrix
            variance_y = sum_y2 - (sum_y * sum_y) / count_matrix
            denominator = np.sqrt(variance_x * variance_y)
            correlations = numerator / denominator

        correlations[~np.isfinite(correlations)] = 0.0
        np.fill_diagonal(correlations, 1.0)

        return self._build_links(correlations, columns=columns)

    def _build_links(self, correlations, columns=None):
        if columns is None:
            columns = list(correlations.columns)
            correlation_values = correlations.to_numpy(dtype=np.float64)
        else:
            correlation_values = correlations

        causal_links = []

        for row_index, row_name in enumerate(columns):
            for col_index, col_name in enumerate(columns):
                if row_index == col_index:
                    continue

                score = float(correlation_values[row_index, col_index])

                if abs(score) > 0.7:
                    causal_links.append(
                        {
                            "cause": row_name,
                            "effect": col_name,
                            "score": score,
                        }
                    )

        return causal_links
