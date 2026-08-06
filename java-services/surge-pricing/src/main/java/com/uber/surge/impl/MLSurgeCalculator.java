package com.uber.surge.impl;

import com.uber.surge.api.ISurgeCalculator;
import com.uber.surge.model.FareModel;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

@Primary
@Service
public class MLSurgeCalculator implements ISurgeCalculator {
    private final FareModel fareModel;
    private double confidenceThreshold = 0.85;

    public MLSurgeCalculator(FareModel fareModel) {
        this.fareModel = fareModel;
    }

    @Override
    public double calculate(String zoneId, int demandScore, int supplyScore) {
        double mlPrediction = predictWithModel(zoneId, demandScore, supplyScore);
        double confidence = getModelConfidence(zoneId);
        if (confidence >= confidenceThreshold) {
            return mlPrediction;
        }
        // Fall back to heuristic when model confidence is low
        double ratio = (double) demandScore / Math.max(supplyScore, 1);
        return fareModel.applyMultiplier(zoneId, ratio);
    }

    @Override
    public double getMultiplier(String zoneId) {
        return fareModel.getBaseMultiplier(zoneId);
    }

    @Override
    public void updateModel(String zoneId, double[] features) {
        fareModel.updateZoneFeatures(zoneId, features);
    }

    private double predictWithModel(String zoneId, int demand, int supply) {
        return 1.0 + (demand - supply) * 0.1;
    }

    private double getModelConfidence(String zoneId) {
        return 0.9; // placeholder
    }
}
