package com.uber.surge.impl;

import com.uber.surge.api.ISurgeCalculator;
import com.uber.surge.model.FareModel;
import org.springframework.stereotype.Service;

@Service
public class DefaultSurgeCalculator implements ISurgeCalculator {
    private final FareModel fareModel;

    public DefaultSurgeCalculator(FareModel fareModel) {
        this.fareModel = fareModel;
    }

    @Override
    public double calculate(String zoneId, int demandScore, int supplyScore) {
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
}
