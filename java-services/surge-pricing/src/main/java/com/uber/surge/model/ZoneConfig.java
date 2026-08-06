package com.uber.surge.model;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "surge.zones")
public class ZoneConfig {
    private List<String> activeZones;
    private double maxMultiplier = 5.0;
    private double defaultBaseFare = 2.50;

    public List<String> getActiveZones() { return activeZones; }
    public void setActiveZones(List<String> zones) { this.activeZones = zones; }
    public double getMaxMultiplier() { return maxMultiplier; }
    public double getDefaultBaseFare() { return defaultBaseFare; }
}
