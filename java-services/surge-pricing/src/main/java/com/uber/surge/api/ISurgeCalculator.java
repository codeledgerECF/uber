package com.uber.surge.api;

public interface ISurgeCalculator {
    double calculate(String zoneId, int demandScore, int supplyScore);
    double getMultiplier(String zoneId);
    void updateModel(String zoneId, double[] features);
}
