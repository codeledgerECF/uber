package com.uber.surge.model;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

@Component
public class FareModel {
    private final Map<String, Double> baseMultipliers = new ConcurrentHashMap<>();
    private final Map<String, double[]> zoneFeatures = new ConcurrentHashMap<>();

    public double applyMultiplier(String zoneId, double ratio) {
        double base = baseMultipliers.getOrDefault(zoneId, 1.0);
        return Math.min(base * ratio, 5.0);
    }

    public double getBaseMultiplier(String zoneId) {
        return baseMultipliers.getOrDefault(zoneId, 1.0);
    }

    public void updateZoneFeatures(String zoneId, double[] features) {
        zoneFeatures.put(zoneId, features);
    }
}
